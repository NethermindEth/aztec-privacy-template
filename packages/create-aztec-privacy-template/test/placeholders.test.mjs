import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	applyPlaceholdersInSelectedFiles,
	getPlaceholderMap,
} from "../dist/placeholders.js";
import { scaffoldBaseTemplate } from "../dist/scaffold.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("getPlaceholderMap builds expected replacement map", () => {
	const map = getPlaceholderMap("my-app", "pnpm");

	assert.equal(map.__PROJECT_NAME__, "my-app");
	assert.equal(map.__INSTALL_COMMAND__, "pnpm install");
});

test("applyPlaceholdersInSelectedFiles replaces README placeholders", async () => {
	const dir = await mkdtemp(join(tmpdir(), "capt-placeholders-"));

	try {
		await writeFile(
			join(dir, "README.md"),
			"# __PROJECT_NAME__\n\n__INSTALL_COMMAND__\n",
			"utf8",
		);

		const map = getPlaceholderMap("demo", "bun");
		await applyPlaceholdersInSelectedFiles(dir, map);

		const readme = await readFile(join(dir, "README.md"), "utf8");
		assert.match(readme, /^# demo/m);
		assert.match(readme, /bun install/);
		assert.doesNotMatch(readme, /__[A-Z0-9_]+__/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("scaffoldBaseTemplate emits project metadata with no unresolved placeholders", async () => {
	const target = await mkdtemp(join(tmpdir(), "capt-scaffold-"));

	try {
		await scaffoldBaseTemplate({
			generatorRoot: PACKAGE_ROOT,
			absoluteTargetPath: target,
			projectName: "phase3-smoke",
			packageManager: "npm",
		});

		const readme = await readFile(join(target, "README.md"), "utf8");
		assert.match(readme, /^# phase3-smoke/m);
		assert.match(readme, /npm install/);
		assert.doesNotMatch(readme, /__[A-Z0-9_]+__/);

		const packageJsonRaw = await readFile(join(target, "package.json"), "utf8");
		const packageJson = JSON.parse(packageJsonRaw);
		assert.equal(packageJson.name, "phase3-smoke");
	} finally {
		await rm(target, { recursive: true, force: true });
	}
});
