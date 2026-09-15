import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
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
		for (let i = 0; i < bytes.readUInt32BE(4); i++) {
			const offset = bytes.readUInt32BE(16 + i * 20);
			const size = bytes.readUInt32BE(20 + i * 20);
			if (offset + size > bytes.length) throw new Error("invalid Mach-O slice");
			slices.push(...machDependencies(bytes.subarray(offset, offset + size)));
		}
		return slices;
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

/**
 * Diagnostic for bundled 64-bit little-endian Mach-O images and fat containers.
 * Includes optional modules not loaded by entrypoint --version; not an ELF/PE validator.
 * Keep separate from installation: upstream's optional OAuth module currently lacks libcurl (#3073).
 */
export function validateRuntimeDependencies(root, links = []) {
	const canonicalRoot = realpathSync(root);
	const aliases = new Map(links.map(({ source, target }) => [resolve(root, target), resolve(root, source)]));
	let images = 0;
	let edges = 0;
	function visit(directory) {
		for (const name of readdirSync(directory)) {
			const path = join(directory, name);
			const stat = lstatSync(path);
			if (stat.isDirectory()) {
				visit(path);
				continue;
			}
			if (!stat.isFile()) continue;
			const dependencies = imageDependencies(readFileSync(path));
			if (dependencies === undefined) continue;
			images++;
			for (const dependency of dependencies) {
				edges++;
				if (dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/")) continue;
				const candidate = resolve(dirname(path), dependency.replace(/^@loader_path\//u, ""));
				const source = aliases.get(candidate) ?? candidate;
				if (!existsSync(source))
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
			}
		}
	}
	visit(root);
	return { images, edges };
}
