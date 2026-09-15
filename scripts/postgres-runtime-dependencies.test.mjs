import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateRuntimeDependencies } from "./postgres-runtime-dependencies.mjs";

function macho(dependency) {
	const name = Buffer.from(`${dependency}\0`);
	const commandSize = 24 + name.length;
	const image = Buffer.alloc(32 + commandSize);
	image.writeUInt32LE(0xfeedfacf, 0);
	image.writeUInt32LE(1, 16);
	image.writeUInt32LE(commandSize, 20);
	image.writeUInt32LE(0xc, 32);
	image.writeUInt32LE(commandSize, 36);
	image.writeUInt32LE(24, 40);
	name.copy(image, 56);
	return image;
}

// #3073: verify all bundled images, not just libraries loaded by --version.
test("dependency closure rejects a missing transitive library and accepts the repaired payload", () => {
	const root = mkdtempSync(join(tmpdir(), "atomic-pg-closure-"));
	try {
		mkdirSync(join(root, "bin"));
		mkdirSync(join(root, "lib"));
		writeFileSync(join(root, "bin/postgres"), macho("@loader_path/../lib/first.dylib"));
		writeFileSync(join(root, "lib/first.dylib"), macho("@loader_path/transitive.dylib"));
		assert.throws(() => validateRuntimeDependencies(root), /transitive.dylib/u);
		writeFileSync(join(root, "lib/transitive.dylib"), macho("/usr/lib/libSystem.B.dylib"));
		assert.equal(validateRuntimeDependencies(root).images, 3);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// #3073: an optional image outside the executable closure must still fail the full-image diagnostic.
test("full-image diagnostic rejects the upstream OAuth module's absent libcurl", () => {
	const root = mkdtempSync(join(tmpdir(), "atomic-pg-oauth-"));
	try {
		mkdirSync(join(root, "bin"));
		mkdirSync(join(root, "lib"));
		writeFileSync(join(root, "bin/postgres"), macho("/usr/lib/libSystem.B.dylib"));
		writeFileSync(join(root, "lib/libpq-oauth-18.dylib"), macho("@loader_path/../lib/libcurl.4.dylib"));
		assert.throws(() => validateRuntimeDependencies(root), /libpq-oauth-18.dylib -> .*libcurl.4.dylib/u);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
