import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateRuntimeDependencies } from "./postgres-runtime-dependencies.mjs";

function elf(dependencies, search, tag = 29) {
	const bytes = Buffer.alloc(2048);
	bytes.writeUInt32BE(0x7f454c46);
	bytes[4] = 2;
	bytes[5] = 1;
	bytes.writeBigUInt64LE(64n, 32);
	bytes.writeUInt16LE(56, 54);
	bytes.writeUInt16LE(2, 56);
	bytes.writeUInt32LE(1, 64);
	bytes.writeBigUInt64LE(2048n, 96);
	bytes.writeUInt32LE(2, 120);
	bytes.writeBigUInt64LE(256n, 128);
	bytes.writeBigUInt64LE(256n, 152);
	bytes.writeBigUInt64LE(5n, 256);
	bytes.writeBigUInt64LE(1024n, 264);
	let offset = 272;
	let string = 1;
	for (const [type, value] of [...dependencies.map((name) => [1, name]), ...(search ? [[tag, search]] : [])]) {
		bytes.writeBigUInt64LE(BigInt(type), offset);
		bytes.writeBigUInt64LE(BigInt(string), offset + 8);
		bytes.write(value, 1024 + string);
		string += Buffer.byteLength(value) + 1;
		offset += 16;
	}
	return bytes;
}

// #3073: upstream musl libraries inherit executable RUNPATH; glibc RUNPATH is direct-only.
for (const [libc, tag, inherited] of [
	["libc.musl-aarch64.so.1", 29, true],
	["libc.so.6", 29, false],
	["libc.so.6", 15, true],
]) {
	test(`ELF loader search semantics: ${libc}, dynamic tag ${tag}`, () => {
		const root = mkdtempSync(join(tmpdir(), "pg-search-"));
		try {
			mkdirSync(join(root, "bin"));
			mkdirSync(join(root, "lib"));
			writeFileSync(join(root, "bin/postgres"), elf(["libfirst.so", libc], "$ORIGIN/../lib", tag));
			writeFileSync(join(root, "lib/libfirst.so"), elf(["libsecond.so", libc]));
			assert.throws(() => validateRuntimeDependencies(root), /libsecond.so/u);
			writeFileSync(join(root, "lib/libsecond.so"), elf([libc]));
			if (inherited) assert.equal(validateRuntimeDependencies(root).images, 3);
			else assert.throws(() => validateRuntimeDependencies(root), /libsecond.so/u);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
}

// #3073: glibc distributions supply the compiler ABI; musl packages carry it themselves.
test("glibc permits host compiler ABI without permitting optional interpreter libraries", () => {
	const root = mkdtempSync(join(tmpdir(), "pg-abi-"));
	try {
		mkdirSync(join(root, "bin"));
		writeFileSync(join(root, "bin/postgres"), elf(["libc.so.6", "libstdc++.so.6", "libgcc_s.so.1"]));
		assert.equal(validateRuntimeDependencies(root).images, 1);
		writeFileSync(join(root, "bin/postgres"), elf(["libc.musl-aarch64.so.1", "libstdc++.so.6"]));
		assert.throws(() => validateRuntimeDependencies(root), /libstdc/u);
		writeFileSync(join(root, "bin/postgres"), elf(["libc.so.6", "libperl.so"]));
		assert.throws(() => validateRuntimeDependencies(root), /libperl/u);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
