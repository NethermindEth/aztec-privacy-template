export interface PromptOptions {
	yes: boolean;
}

export async function resolvePromptOptions(
	options: PromptOptions,
): Promise<PromptOptions> {
	return options;
}
