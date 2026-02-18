import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
	SCAFFOLD_DIR,
	STARTER_PACKAGE_JSON_BASE,
	TEMPLATE_COPY_ENTRIES,
} from "./constants.js";

export interface ScaffoldOptions {
	generatorRoot: string;
	absoluteTargetPath: string;
	projectName: string;
}

export async function scaffoldBaseTemplate(
	options: ScaffoldOptions,
): Promise<void> {
	const { generatorRoot, absoluteTargetPath, projectName } = options;

	await mkdir(absoluteTargetPath, { recursive: true });

	for (const entry of TEMPLATE_COPY_ENTRIES) {
		const sourcePath = join(generatorRoot, SCAFFOLD_DIR, entry);
		const destinationEntry = entry === "gitignore" ? ".gitignore" : entry;
		const destinationPath = join(absoluteTargetPath, destinationEntry);

		await cp(sourcePath, destinationPath, {
			recursive: true,
			errorOnExist: true,
			force: false,
			preserveTimestamps: true,
		});
	}

	const packageJson = {
		...STARTER_PACKAGE_JSON_BASE,
		name: projectName,
	};

	await writeFile(
		join(absoluteTargetPath, "package.json"),
		`${JSON.stringify(packageJson, null, 2)}\n`,
		"utf8",
	);
}
