import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

function cstring(bytes, offset) {
	if (offset < 0 || offset >= bytes.length) throw new Error("invalid dependency string offset");
	const end = bytes.indexOf(0, offset);
	if (end < 0) throw new Error("unterminated dependency string");
	return bytes.toString("utf8", offset, end);
}

function machDependencies(bytes) {
	if (bytes.readUInt32BE(0) === 0xcafebabe) {
		const slices = [];
		let hasImages = false;
		for (let i = 0; i < bytes.readUInt32BE(4); i++) {
			const offset = bytes.readUInt32BE(16 + i * 20);
			const size = bytes.readUInt32BE(20 + i * 20);
			if (offset + size > bytes.length) throw new Error("invalid Mach-O slice");
			const slice = bytes.subarray(offset, offset + size);
			// Universal containers also hold static ar archives (e.g. language-pack development libraries).
			if (slice.subarray(0, 8).toString("ascii") === "!<arch>\n") continue;
			slices.push(...machDependencies(slice));
			hasImages = true;
		}
		return hasImages ? slices : undefined;
	}
	const dependencies = [];
	let offset = 32;
	for (let i = 0; i < bytes.readUInt32LE(16); i++) {
		const command = bytes.readUInt32LE(offset);
		const size = bytes.readUInt32LE(offset + 4);
		if (size < 8 || offset + size > bytes.length) throw new Error("invalid Mach-O load command");
		// LC_ID_DYLIB is an install name, not a dependency. Weak/reexport/upward
		// imports still belong to the packaged closure and are checked too.
		if ([0xc, 0x80000018, 0x8000001f, 0x80000023].includes(command)) {
			dependencies.push(cstring(bytes, offset + bytes.readUInt32LE(offset + 8)));
		}
		offset += size;
	}
	return dependencies;
}

function imageDependencies(bytes) {
	if (bytes.length < 32) return undefined;
	if (bytes.readUInt32LE(0) === 0xfeedfacf || bytes.readUInt32BE(0) === 0xcafebabe) return machDependencies(bytes);
	return undefined;
}

function elfDependencies(bytes) {
	if (bytes.length < 64 || bytes.readUInt32BE(0) !== 0x7f454c46) return undefined;
	if (bytes[4] !== 2 || bytes[5] !== 1) throw new Error("unsupported ELF dependency format");
	const u64 = (offset) => Number(bytes.readBigUInt64LE(offset));
	const segments = [];
	let dynamic;
	for (let i = 0; i < bytes.readUInt16LE(56); i++) {
		const offset = u64(32) + i * bytes.readUInt16LE(54);
		const segment = {
			type: bytes.readUInt32LE(offset),
			offset: u64(offset + 8),
			address: u64(offset + 16),
			size: u64(offset + 32),
		};
		if (segment.offset + segment.size > bytes.length) throw new Error("invalid ELF segment");
		if (segment.type === 1) segments.push(segment);
		if (segment.type === 2) dynamic = segment;
	}
	if (!dynamic) return { dependencies: [], rpaths: [] };
	const needed = [],
		paths = [];
	let strings;
	for (let offset = dynamic.offset; offset + 16 <= dynamic.offset + dynamic.size; offset += 16) {
		const tag = u64(offset),
			value = u64(offset + 8);
		if (tag === 0) break;
		if (tag === 1) needed.push(value);
		if (tag === 5) strings = value;
		if (tag === 15 || tag === 29) paths.push(value);
	}
	if (needed.length === 0) return { dependencies: [], rpaths: [] };
	const segment = segments.find(({ address, size }) => strings >= address && strings < address + size);
	if (!segment) throw new Error("invalid ELF dynamic string table");
	const base = segment.offset + strings - segment.address;
	return {
		dependencies: needed.map((offset) => cstring(bytes, base + offset)),
		rpaths: paths.flatMap((offset) => cstring(bytes, base + offset).split(":")),
	};
}

// The host ABI supplies its C runtime and dynamic loader, never Perl/Python/Tcl
// or non-system third-party libraries. Do not consult the build host's ld cache.
const ELF_SYSTEM_LIBRARIES = new Set([
	"libc.so.6",
	"libm.so.6",
	"libdl.so.2",
	"libpthread.so.0",
	"librt.so.1",
	"libresolv.so.2",
	"libutil.so.1",
	"libcrypt.so.1",
	"libnsl.so.1",
	"ld-linux-x86-64.so.2",
	"ld-linux-aarch64.so.1",
	"libc.musl-x86_64.so.1",
	"libc.musl-aarch64.so.1",
]);

/**
 * Required startup/workflow entrypoint closure for Mach-O/fat and ELF images.
 * Optional modules are not roots. PE/DLL validation remains with Windows probes.
 */
export function validateRuntimeDependencies(root, links = []) {
	const canonicalRoot = realpathSync(root);
	const aliases = new Map(links.map(({ source, target }) => [resolve(root, target), resolve(root, source)]));
	let images = 0;
	let edges = 0;
	const visited = new Set();
	function visit(path) {
		const canonical = realpathSync(path);
		if (visited.has(canonical)) return;
		visited.add(canonical);
		const bytes = readFileSync(path);
		const elf = elfDependencies(bytes);
		const dependencies = elf?.dependencies ?? imageDependencies(bytes);
		if (dependencies === undefined) return;
		images++;
		for (const dependency of dependencies) {
			edges++;
			if (
				elf
					? ELF_SYSTEM_LIBRARIES.has(dependency)
					: dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/")
			)
				continue;
			const candidates = elf
				? elf.rpaths
						.filter((search) => /^\$(?:ORIGIN|\{ORIGIN\})(?:\/|$)/u.test(search))
						.map((search) => resolve(search.replace(/\$\{ORIGIN\}|\$ORIGIN/gu, dirname(path)), dependency))
				: [resolve(dirname(path), dependency.replace(/^@loader_path\//u, ""))];
			const source = candidates
				.map((candidate) => aliases.get(candidate) ?? candidate)
				.find((candidate) => existsSync(candidate));
			if (source === undefined)
				throw new Error(`incomplete PostgreSQL dependency closure: ${relative(root, path)} -> ${dependency}`);
			const contained = relative(canonicalRoot, realpathSync(source));
			if (
				isAbsolute(contained) ||
				contained === ".." ||
				contained.startsWith("../") ||
				contained.startsWith("..\\") ||
				!lstatSync(source).isFile()
			)
				throw new Error(`PostgreSQL dependency escapes payload: ${dependency}`);
			visit(source);
		}
	}
	for (const name of ["postgres", "pg_ctl", "initdb"]) {
		const path = join(root, "bin", name);
		// The producer validates presence and architecture, including Windows .exe.
		if (existsSync(path)) visit(path);
	}
	return { images, edges };
}
