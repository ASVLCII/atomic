import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { createChildProcessEnvironment } from "@bastani/atomic";

export interface BunSubprocessOptions {
	timeoutMs: number;
	maxStdoutBytes: number;
	maxStderrBytes?: number;
	signal?: AbortSignal;
	cwd?: string;
	env?: Record<string, string>;
}

export interface BunSubprocessResult {
	exitCode: number;
	stdout: Buffer;
	stderr: string;
}

export class AsyncSubprocessError extends Error {
	readonly code?: string;
	readonly stderr: string;
	readonly killed: boolean;
	constructor(message: string, options: { code?: string; stderr?: string; killed?: boolean } = {}) {
		super(message);
		this.name = "AsyncSubprocessError";
		this.code = options.code;
		this.stderr = options.stderr ?? "";
		this.killed = options.killed === true;
	}
}

async function readBounded(stream: Readable, maxBytes: number, onOverflow: () => void): Promise<Buffer> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	let overflow = false;
	for await (const chunk of stream) {
		const value = chunk as Buffer;
		bytes += value.byteLength;
		if (bytes > maxBytes) {
			if (!overflow) onOverflow();
			overflow = true;
		} else {
			chunks.push(value);
		}
	}
	if (overflow) {
		throw new AsyncSubprocessError(`Subprocess output exceeded ${maxBytes} bytes`, { code: "ENOBUFS", killed: true });
	}
	return Buffer.concat(chunks, bytes);
}

/** Node's child-process adapter also runs in the compiled Bun host. */
export async function runBunSubprocess(
	command: string,
	args: readonly string[],
	options: BunSubprocessOptions,
): Promise<BunSubprocessResult> {
	if (options.signal?.aborted) {
		throw new AsyncSubprocessError(`${command} aborted`, { code: "ABORT_ERR", killed: true });
	}
	let timedOut = false;
	let aborted = false;
	let escalation: ReturnType<typeof setTimeout> | undefined;
	const proc = spawn(command, args, {
		cwd: options.cwd,
		env: createChildProcessEnvironment(options.env),
		stdio: ["ignore", "pipe", "pipe"],
	});
	const exited = new Promise<number>((resolve, reject) => {
		proc.once("error", (error: NodeJS.ErrnoException) => {
			reject(new AsyncSubprocessError(error.message, { code: error.code }));
		});
		proc.once("close", (code) => resolve(code ?? -1));
	});
	const terminate = (): void => {
		if (escalation) return;
		proc.kill("SIGTERM");
		escalation = setTimeout(() => { proc.kill("SIGKILL"); }, 500);
	};
	const onAbort = (): void => { aborted = true; terminate(); };
	options.signal?.addEventListener("abort", onAbort, { once: true });
	const timeout = setTimeout(() => { timedOut = true; terminate(); }, options.timeoutMs);
	const output = [
		readBounded(proc.stdout, options.maxStdoutBytes, terminate),
		readBounded(proc.stderr, options.maxStderrBytes ?? 256 * 1024, terminate),
	] as const;
	try {
		const [exitCode, stdout, stderrBuffer] = await Promise.all([exited, ...output]);
		const stderr = stderrBuffer.toString("utf8");
		if (timedOut) throw new AsyncSubprocessError(`${command} timed out`, { code: "ETIMEDOUT", stderr, killed: true });
		if (aborted) throw new AsyncSubprocessError(`${command} aborted`, { code: "ABORT_ERR", stderr, killed: true });
		if (exitCode !== 0) throw new AsyncSubprocessError(`${command} exited with code ${exitCode}`, { code: String(exitCode), stderr });
		return { exitCode, stdout, stderr };
	} catch (error) {
		terminate();
		await Promise.allSettled([exited, ...output]);
		if (error instanceof AsyncSubprocessError) throw error;
		throw new AsyncSubprocessError(error instanceof Error ? error.message : String(error), { killed: true });
	} finally {
		clearTimeout(timeout);
		clearTimeout(escalation);
		options.signal?.removeEventListener("abort", onAbort);
	}
}
