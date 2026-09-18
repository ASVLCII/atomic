import { constants, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join, parse, resolve } from "node:path";
import { type Api, type Model, modelsAreEqual } from "@bastani/pi-ai/compat";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { resolvePath } from "../utils/paths.ts";
import type { AgentSession } from "./agent-session.js";
import type { AgentSessionInternalSurface } from "./agent-session-methods.ts";
import { type AtomicOAuthLoginCallbacks, loginRuntimeOAuthProvider } from "./agent-session-runtime-auth.ts";
import type { AgentSessionRuntimeDiagnostic, AgentSessionServices } from "./agent-session-services.ts";
import type {
	ProjectTrustContext,
	ReplacedSessionContext,
	SessionShutdownEvent,
	SessionStartEvent,
} from "./extensions/index.js";
import { emitSessionShutdownEvent } from "./extensions/runner.ts";
import type { ModelFallbackReason } from "./model-resolver-types.ts";
import type { AuthStatus } from "./provider-composer.ts";
import type { CreateAgentSessionResult } from "./sdk.ts";
import { assertSessionCwdExists } from "./session-cwd.ts";
import { sessionLifecycleCreation, sessionLifecycleScopes } from "./session-lifecycle-scope.ts";
import { drainSessionWork, trackSessionWork } from "./session-lifecycle-work.ts";
import { SessionManager } from "./session-manager.ts";

/**
 * Result returned by runtime creation.
 *
 * The caller gets the created session, its cwd-bound services, and all
 * diagnostics collected during setup.
 */
export interface CreateAgentSessionRuntimeResult extends CreateAgentSessionResult {
	services: AgentSessionServices;
	diagnostics: AgentSessionRuntimeDiagnostic[];
}

export interface LogoutProviderResult {
	provider: string;
	authStatus: AuthStatus;
	models: Model<Api>[];
	scopedModels?: Array<{ model: Model<Api>; thinkingLevel?: ThinkingLevel }>;
}

/**
 * Creates a full runtime for a target cwd and session manager.
 *
 * The factory closes over process-global fixed inputs, recreates cwd-bound
 * services for the effective cwd, resolves session options against those
 * services, and finally creates the AgentSession.
 */
export interface CreateAgentSessionRuntimeOptions {
	cwd: string;
	agentDir: string;
	sessionManager: SessionManager;
	sessionStartEvent?: SessionStartEvent;
	projectTrustContext?: ProjectTrustContext;
}

export type CreateAgentSessionRuntimeFactory = {
	(options: CreateAgentSessionRuntimeOptions): Promise<CreateAgentSessionRuntimeResult>;
	prepareResume?: (
		options: CreateAgentSessionRuntimeOptions,
	) => Promise<() => Promise<CreateAgentSessionRuntimeResult>>;
};

const SESSION_REPLACEMENT_UI_PROMPT_SETTLEMENT_TIMEOUT_MS = 1_000;

/**
 * Thrown when /import references a JSONL file path that does not exist.
 */
export class SessionImportFileNotFoundError extends Error {
	readonly filePath: string;

	constructor(filePath: string) {
		super(`File not found: ${filePath}`);
		this.name = "SessionImportFileNotFoundError";
		this.filePath = filePath;
	}
}

function extractUserMessageText(content: string | Array<{ type: string; text?: string }>): string {
	if (typeof content === "string") {
		return content;
	}

	return content
		.filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("");
}

/**
 * Owns the current AgentSession plus its cwd-bound services.
 *
 * Session replacement methods tear down the current runtime first, then create
 * and apply the next runtime. If creation fails, the error is propagated to the
 * caller. The caller is responsible for user-facing error handling.
 */
export class AgentSessionRuntime {
	private rebindSession?: (session: AgentSession) => Promise<void>;
	private beforeSessionInvalidate?: () => void;
	private projectTrustContextFactory?: (cwd: string) => ProjectTrustContext;
	private closed = false;
	private closing?: Promise<void>;
	private cleanupFailures: unknown[] = [];
	private candidates = new Set<AgentSession>();

	private assertOpen(): void {
		if (this.closed) throw Object.assign(new Error("Session is closed"), { code: "SessionClosed" });
	}

	private admit<T>(operation: () => Promise<T>): Promise<T> {
		try {
			this.assertOpen();
		} catch (error) {
			return Promise.reject(error);
		}
		return trackSessionWork(this, operation);
	}

	/** Bind a process-local trust UI; closures never cross the engine RPC boundary. */
	setProjectTrustContextFactory(factory: (cwd: string) => ProjectTrustContext): void {
		this.projectTrustContextFactory = factory;
	}

	/** Return false for ordinary startup; otherwise finish the safe session in place. */
	async completeStartup(): Promise<boolean> {
		return this.admit(async () => {
			const complete = this.services.completeStartup;
			if (!complete) return false;
			if (!this.projectTrustContextFactory) throw new Error("Startup trust requires a bound session UI");
			await complete(this.projectTrustContextFactory(this.services.cwd));
			return true;
		});
	}

	private declare _session: AgentSession;
	private declare _services: AgentSessionServices;
	private declare readonly createRuntime: CreateAgentSessionRuntimeFactory;
	private declare _diagnostics: AgentSessionRuntimeDiagnostic[];
	private declare _modelFallbackMessage?: string;
	private declare _modelFallbackReason?: ModelFallbackReason;

	constructor(
		_session: AgentSession,
		_services: AgentSessionServices,
		createRuntime: CreateAgentSessionRuntimeFactory,
		_diagnostics: AgentSessionRuntimeDiagnostic[] = [],
		_modelFallbackMessage?: string,
		_modelFallbackReason?: ModelFallbackReason,
	) {
		this._session = _session;
		this._services = _services;
		const scope = sessionLifecycleScopes.get(_session) ?? {};
		const context = () => {
			const current = this._session as unknown as AgentSessionInternalSurface;
			return {
				scope,
				bindings: {
					...this._session.extensionRunner.getChildHostBindings(),
					uiContext: current._extensionUIContext,
					mode: current._extensionMode,
					commandContextActions: current._extensionCommandContextActions,
					shutdownHandler: current._extensionShutdownHandler,
					onError: current._extensionErrorListener,
				},
			};
		};
		this.createRuntime = (options) =>
			this.createReplacement(() => sessionLifecycleCreation.run(context(), () => createRuntime(options)));
		this.createRuntime.prepareResume = (options) =>
			sessionLifecycleCreation.run(context(), async () => {
				const complete = createRuntime.prepareResume
					? await createRuntime.prepareResume(options)
					: () => createRuntime(options);
				return () => this.createReplacement(() => sessionLifecycleCreation.run(context(), complete));
			});
		this._diagnostics = _diagnostics;
		this._modelFallbackMessage = _modelFallbackMessage;
		this._modelFallbackReason = _modelFallbackReason;
	}

	private retainCleanupFailures(error: unknown): void {
		if (error instanceof Error && "code" in error && error.code === "ShutdownFailed") {
			this.cleanupFailures.push(error);
		} else if (error instanceof AggregateError) {
			for (const nested of error.errors) this.retainCleanupFailures(nested);
		}
	}

	private async createReplacement(
		create: () => Promise<CreateAgentSessionRuntimeResult>,
	): Promise<CreateAgentSessionRuntimeResult> {
		try {
			this.assertOpen();
			const candidate = await create();
			this.candidates.add(candidate.session);
			if (this.closed) {
				try {
					await candidate.session.dispose();
				} catch (error) {
					this.cleanupFailures.push(error);
				}
				this.candidates.delete(candidate.session);
				this.assertOpen();
			}
			return candidate;
		} catch (cause) {
			this.retainCleanupFailures(cause);
			// Replacement shutdown retained workflow ownership for a successor. If
			// creation fails, no successor can deliver its final quit. The outgoing
			// session's cached close is already settled, so finalize its handlers
			// explicitly without re-running disposal or reviving its stale context.
			try {
				await emitSessionShutdownEvent(this.session.extensionRunner, { type: "session_shutdown", reason: "quit" });
			} catch (cleanupError) {
				this.cleanupFailures.push(cleanupError);
				throw new AggregateError([cause, cleanupError], "Session replacement and retained cleanup failed");
			}
			throw cause;
		}
	}

	get services(): AgentSessionServices {
		return this._services;
	}

	get session(): AgentSession {
		return this._session;
	}

	get cwd(): string {
		return this._services.cwd;
	}

	get diagnostics(): readonly AgentSessionRuntimeDiagnostic[] {
		return this._diagnostics;
	}

	get modelFallbackMessage(): string | undefined {
		return this._modelFallbackMessage;
	}

	get modelFallbackReason(): ModelFallbackReason | undefined {
		return this._modelFallbackReason;
	}

	replaceModelFallback(message?: string, reason?: ModelFallbackReason): void {
		this._modelFallbackMessage = message;
		this._modelFallbackReason = reason;
	}

	resolveModelFallback(): void {
		this.replaceModelFallback();
	}

	resolveModelFallbackAfterExplicitModelSelection(
		previousModel: Model<Api> | undefined,
		selectedModel: Model<Api> | null | undefined,
	): void {
		if (selectedModel && !modelsAreEqual(previousModel, selectedModel)) this.resolveModelFallback();
	}

	async loginOAuthProvider(
		provider: string,
		callbacks: AtomicOAuthLoginCallbacks,
	): Promise<{ modelsRefreshed: boolean }> {
		return this.admit(async () => {
			await loginRuntimeOAuthProvider(this.session, provider, callbacks);
			return { modelsRefreshed: true };
		});
	}

	async logoutProvider(provider: string): Promise<LogoutProviderResult> {
		return this.admit(async () => {
			const registry = this.session.modelRuntime;
			await registry.logout(provider);
			const availableIds = new Set(registry.getAvailableSnapshot().map((model) => `${model.provider}\0${model.id}`));
			const scopedModels = this.session.scopedModels.filter(({ model }) =>
				availableIds.has(`${model.provider}\0${model.id}`),
			);
			this.session.setScopedModels([...scopedModels]);
			this.session.refreshCurrentModelFromRegistry();
			return {
				provider,
				authStatus: registry.getProviderAuthStatus(provider),
				models: [...registry.getAvailableSnapshot()],
				scopedModels: [...scopedModels],
			};
		});
	}

	setRebindSession(rebindSession?: (session: AgentSession) => Promise<void>): void {
		this.rebindSession = rebindSession;
	}

	/**
	 * Set a synchronous callback that runs after `session_shutdown` handlers finish
	 * but before the current session is invalidated.
	 *
	 * This is for host-owned UI teardown that must not yield to the event loop,
	 * such as detaching extension-provided TUI components before the old extension
	 * context becomes stale.
	 */
	setBeforeSessionInvalidate(beforeSessionInvalidate?: () => void): void {
		this.beforeSessionInvalidate = beforeSessionInvalidate;
	}

	private async emitBeforeSwitch(
		reason: "new" | "resume",
		targetSessionFile?: string,
	): Promise<{ cancelled: boolean }> {
		const runner = this.session.extensionRunner;
		if (!runner.hasHandlers("session_before_switch")) {
			return { cancelled: false };
		}

		const result = await runner.emit({
			type: "session_before_switch",
			reason,
			targetSessionFile,
		});
		this.assertOpen();
		return { cancelled: result?.cancel === true };
	}

	private async emitBeforeFork(
		entryId: string,
		options: { position: "before" | "at" },
	): Promise<{ cancelled: boolean }> {
		const runner = this.session.extensionRunner;
		if (!runner.hasHandlers("session_before_fork")) {
			return { cancelled: false };
		}

		const result = await runner.emit({
			type: "session_before_fork",
			entryId,
			...options,
		});
		this.assertOpen();
		return { cancelled: result?.cancel === true };
	}

	private disposeCurrentSession(event: SessionShutdownEvent): Promise<void> {
		return (this.session as unknown as AgentSessionInternalSurface)._close(event, this.beforeSessionInvalidate);
	}

	/**
	 * Settle an active response before the session it belongs to is replaced, so the
	 * aborted turn (including its tool results) is persisted to the outgoing session
	 * rather than stranded.
	 *
	 * Overridable because the isolated engine must not re-enter its cooperative
	 * abort wait here: the child engine settles its own turn before it reports the
	 * replacement, and the host facade's `abort()` is an unbounded round trip that
	 * would hang teardown on an unresponsive or dead engine.
	 */
	protected async settleActiveResponseBeforeTeardown(): Promise<void> {
		if (!this.session.isStreaming) return;
		await this.session.abort();
	}

	private async teardownCurrent(reason: SessionShutdownEvent["reason"], targetSessionFile?: string): Promise<void> {
		this.assertOpen();
		await this.settleActiveResponseBeforeTeardown();
		this.assertOpen();
		const { timedOut } = await this.session.extensionRunner.flushUIPromptNotifications(
			SESSION_REPLACEMENT_UI_PROMPT_SETTLEMENT_TIMEOUT_MS,
		);
		this.assertOpen();
		if (timedOut) {
			console.error("Warning: UI prompt observers did not settle within 1,000 ms; continuing session replacement.");
		}
		try {
			await this.disposeCurrentSession({ type: "session_shutdown", reason, targetSessionFile });
		} catch (cause) {
			this.retainCleanupFailures(cause);
			try {
				await emitSessionShutdownEvent(this.session.extensionRunner, { type: "session_shutdown", reason: "quit" });
			} catch (cleanupError) {
				this.cleanupFailures.push(cleanupError);
				throw Object.assign(
					new AggregateError([cause, cleanupError], "Session retirement and retained cleanup failed"),
					{
						code: "ShutdownFailed",
					},
				);
			}
			throw cause;
		}
	}

	private apply(result: CreateAgentSessionRuntimeResult): void {
		this.assertOpen();
		this.candidates.delete(result.session);
		this._session = result.session;
		this._services = result.services;
		this._diagnostics = result.diagnostics;
		this._modelFallbackMessage = result.modelFallbackMessage;
		this._modelFallbackReason = result.modelFallbackReason;
	}

	private async finishSessionReplacement(withSession?: (ctx: ReplacedSessionContext) => Promise<void>): Promise<void> {
		this.assertOpen();
		if (this.rebindSession) {
			await this.rebindSession(this.session);
			this.assertOpen();
		}
		if (withSession) {
			await withSession(this.session.createReplacedSessionContext());
		}
	}

	async switchSession(
		sessionPath: string,
		options?: {
			cwdOverride?: string;
			withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
			projectTrustContextFactory?: (cwd: string) => ProjectTrustContext;
		},
	): Promise<{ cancelled: boolean }> {
		return this.admit(async () => {
			const beforeResult = await this.emitBeforeSwitch("resume", sessionPath);
			this.assertOpen();
			if (beforeResult.cancelled) {
				return beforeResult;
			}

			const previousSessionFile = this.session.sessionFile;
			const sessionManager = SessionManager.open(sessionPath, undefined, options?.cwdOverride);
			assertSessionCwdExists(sessionManager, this.cwd);
			const runtimeOptions: CreateAgentSessionRuntimeOptions = {
				cwd: sessionManager.getCwd(),
				agentDir: this.services.agentDir,
				sessionManager,
				sessionStartEvent: { type: "session_start", reason: "resume", previousSessionFile },
				projectTrustContext: (options?.projectTrustContextFactory ?? this.projectTrustContextFactory)?.(
					sessionManager.getCwd(),
				),
			};
			await this.settleActiveResponseBeforeTeardown();
			this.assertOpen();
			const complete = await this.createRuntime.prepareResume?.(runtimeOptions);
			this.assertOpen();
			await this.teardownCurrent("resume", sessionManager.getSessionFile());
			this.apply(await (complete ? complete() : this.createRuntime(runtimeOptions)));
			await this.finishSessionReplacement(options?.withSession);
			return { cancelled: false };
		});
	}

	async newSession(options?: {
		parentSession?: string;
		setup?: (sessionManager: SessionManager) => Promise<void>;
		withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
	}): Promise<{ cancelled: boolean }> {
		return this.admit(async () => {
			const beforeResult = await this.emitBeforeSwitch("new");
			this.assertOpen();
			if (beforeResult.cancelled) {
				return beforeResult;
			}

			const previousSessionFile = this.session.sessionFile;
			const sessionDir = this.session.sessionManager.getSessionDir();
			const sessionManager = SessionManager.create(this.cwd, sessionDir);
			if (options?.parentSession) {
				sessionManager.newSession({ parentSession: options.parentSession });
			}

			await this.teardownCurrent("new", sessionManager.getSessionFile());
			this.apply(
				await this.createRuntime({
					cwd: this.cwd,
					agentDir: this.services.agentDir,
					sessionManager,
					sessionStartEvent: { type: "session_start", reason: "new", previousSessionFile },
				}),
			);
			if (options?.setup) {
				await options.setup(this.session.sessionManager);
				this.assertOpen();
				this.session.agent.state.messages = this.session.sessionManager.buildSessionContext().messages;
			}
			await this.finishSessionReplacement(options?.withSession);
			return { cancelled: false };
		});
	}

	async fork(
		entryId: string,
		options?: { position?: "before" | "at"; withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	): Promise<{ cancelled: boolean; selectedText?: string }> {
		return this.admit(async () => {
			const position = options?.position ?? "before";
			const beforeResult = await this.emitBeforeFork(entryId, { position });
			this.assertOpen();
			if (beforeResult.cancelled) {
				return { cancelled: true };
			}
			let targetLeafId: string | null;
			let selectedText: string | undefined;

			const selectedEntry = this.session.sessionManager.getEntry(entryId);
			if (!selectedEntry) {
				throw new Error("Invalid entry ID for forking");
			}

			if (position === "at") {
				targetLeafId = selectedEntry.id;
			} else {
				if (selectedEntry.type !== "message" || selectedEntry.message.role !== "user") {
					throw new Error("Invalid entry ID for forking");
				}
				targetLeafId = selectedEntry.parentId;
				selectedText = extractUserMessageText(selectedEntry.message.content);
			}

			const previousSessionFile = this.session.sessionFile;
			if (this.session.sessionManager.isPersisted()) {
				const currentSessionFile = this.session.sessionFile;
				if (!currentSessionFile) {
					throw new Error("Persisted session is missing a session file");
				}
				const sessionDir = this.session.sessionManager.getSessionDir();
				if (!targetLeafId) {
					const sessionManager = SessionManager.create(this.cwd, sessionDir);
					sessionManager.newSession({ parentSession: currentSessionFile });
					await this.teardownCurrent("fork", sessionManager.getSessionFile());
					this.apply(
						await this.createRuntime({
							cwd: this.cwd,
							agentDir: this.services.agentDir,
							sessionManager,
							sessionStartEvent: { type: "session_start", reason: "fork", previousSessionFile },
						}),
					);
					await this.finishSessionReplacement(options?.withSession);
					return { cancelled: false, selectedText };
				}

				if (!existsSync(currentSessionFile)) {
					throw new Error(
						"This session has not been saved yet. Wait for the first assistant response before cloning or forking it.",
					);
				}
				const sessionManager = SessionManager.open(currentSessionFile, sessionDir);
				const forkedSessionPath = sessionManager.createBranchedSession(targetLeafId);
				if (!forkedSessionPath) {
					throw new Error("Failed to create forked session");
				}
				await this.teardownCurrent("fork", sessionManager.getSessionFile());
				this.apply(
					await this.createRuntime({
						cwd: sessionManager.getCwd(),
						agentDir: this.services.agentDir,
						sessionManager,
						sessionStartEvent: { type: "session_start", reason: "fork", previousSessionFile },
					}),
				);
				await this.finishSessionReplacement(options?.withSession);
				return { cancelled: false, selectedText };
			}

			const sessionManager = this.session.sessionManager;
			await this.teardownCurrent("fork", sessionManager.getSessionFile());
			if (!targetLeafId) {
				sessionManager.newSession({ parentSession: previousSessionFile });
			} else {
				sessionManager.createBranchedSession(targetLeafId);
			}
			this.apply(
				await this.createRuntime({
					cwd: this.cwd,
					agentDir: this.services.agentDir,
					sessionManager,
					sessionStartEvent: { type: "session_start", reason: "fork", previousSessionFile },
				}),
			);
			await this.finishSessionReplacement(options?.withSession);
			return { cancelled: false, selectedText };
		});
	}

	/**
	 * Import a session JSONL file and switch runtime state to the imported session.
	 *
	 * @returns `{ cancelled: true }` when cancelled by `session_before_switch`, otherwise `{ cancelled: false }`.
	 * @throws {SessionImportFileNotFoundError} When the input path does not exist.
	 * @throws {MissingSessionCwdError} When the imported session cwd cannot be resolved and no override is provided.
	 */
	async importFromJsonl(inputPath: string, cwdOverride?: string): Promise<{ cancelled: boolean }> {
		return this.admit(async () => {
			const resolvedPath = resolvePath(inputPath);
			if (!existsSync(resolvedPath)) {
				throw new SessionImportFileNotFoundError(resolvedPath);
			}

			const sessionDir = this.session.sessionManager.getSessionDir();
			if (!existsSync(sessionDir)) {
				mkdirSync(sessionDir, { recursive: true });
			}

			let destinationPath = join(sessionDir, basename(resolvedPath));
			const sourceAlreadyStored = resolve(destinationPath) === resolvedPath;
			if (!sourceAlreadyStored) {
				const { name, ext } = parse(destinationPath);
				let suffix = 1;
				while (existsSync(destinationPath)) {
					destinationPath = join(sessionDir, `${name}-${suffix++}${ext}`);
				}
			}
			const beforeResult = await this.emitBeforeSwitch("resume", destinationPath);
			this.assertOpen();
			if (beforeResult.cancelled) {
				return beforeResult;
			}

			const previousSessionFile = this.session.sessionFile;
			if (!sourceAlreadyStored) {
				copyFileSync(resolvedPath, destinationPath, constants.COPYFILE_EXCL);
			}

			const sessionManager = SessionManager.open(destinationPath, sessionDir, cwdOverride);
			assertSessionCwdExists(sessionManager, this.cwd);
			await this.teardownCurrent("resume", sessionManager.getSessionFile());
			this.apply(
				await this.createRuntime({
					cwd: sessionManager.getCwd(),
					agentDir: this.services.agentDir,
					sessionManager,
					sessionStartEvent: { type: "session_start", reason: "resume", previousSessionFile },
				}),
			);
			await this.finishSessionReplacement();
			return { cancelled: false };
		});
	}

	dispose(): Promise<void> {
		if (this.closing) return this.closing;
		this.closed = true;
		const current = this.disposeCurrentSession({ type: "session_shutdown", reason: "quit" });
		void current.catch(() => {});
		this.closing = (async () => {
			await drainSessionWork(this);
			for (const candidate of this.candidates) {
				try {
					await candidate.dispose();
				} catch (error) {
					this.cleanupFailures.push(error);
				}
			}
			this.candidates.clear();
			try {
				await current;
			} catch (error) {
				this.cleanupFailures.push(error);
			}
			if (this.cleanupFailures.length)
				throw Object.assign(new AggregateError(this.cleanupFailures, "Runtime shutdown failed"), {
					code: "ShutdownFailed",
				});
		})();
		return this.closing;
	}
}

/**
 * Create the initial runtime from a runtime factory and initial session target.
 *
 * The same factory is stored on the returned AgentSessionRuntime and reused for
 * later /new, /resume, /fork, and import flows.
 */
export async function createAgentSessionRuntime(
	createRuntime: CreateAgentSessionRuntimeFactory,
	options: {
		cwd: string;
		agentDir: string;
		sessionManager: SessionManager;
		sessionStartEvent?: SessionStartEvent;
	},
): Promise<AgentSessionRuntime> {
	assertSessionCwdExists(options.sessionManager, options.cwd);
	const result = await sessionLifecycleCreation.run({ scope: {} }, () => createRuntime(options));
	return new AgentSessionRuntime(
		result.session,
		result.services,
		createRuntime,
		result.diagnostics,
		result.modelFallbackMessage,
		result.modelFallbackReason,
	);
}

export {
	type AgentSessionRuntimeDiagnostic,
	type AgentSessionServices,
	type CreateAgentSessionFromServicesOptions,
	type CreateAgentSessionServicesOptions,
	createAgentSessionFromServices,
	createAgentSessionServices,
} from "./agent-session-services.ts";
