import { readBackground, type BackgroundChoice } from './backgrounds.ts';

let current = $state<BackgroundChoice | undefined>();
/**
 * The background for every game, shared by its Settings row and the Board settings preview
 * (Trevor, 2026-10-20), so a choice shows in the preview at once.
 */
export const defaultBackground = {
	get current(): BackgroundChoice | undefined {
		return current;
	},
	/** Reads the saved choice again (the board's own row can change it too). */
	async load(): Promise<void> {
		current = await readBackground('default');
	},
	/** The choice just saved. */
	set(choice: BackgroundChoice | undefined) {
		current = choice;
	}
};
