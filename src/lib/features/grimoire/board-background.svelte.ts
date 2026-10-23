import type { BackgroundChoice } from './backgrounds.ts';

/**
 * The open board's background, for the Background row in Board and tokens (Trevor,
 * 2026-10-18: one way in, no separate Background dialog). Set while a board is on screen;
 * Settings opened anywhere else shows only the background for all games.
 */
export interface BoardBackgroundContext {
	readonly gameId: string;
	/** The script's background link, if it has one. */
	readonly scriptImage: string | undefined;
	/** The script's logo and name as the board shows them, for the Board settings preview. */
	readonly scriptLogo?: string | undefined;
	readonly scriptName?: string | undefined;
	/** What the board shows now. */
	readonly current: BackgroundChoice;
	/** A choice was saved: the board reads it again. */
	onChange(): void;
}

let context = $state<BoardBackgroundContext>();

export const boardBackground = {
	get context(): BoardBackgroundContext | undefined {
		return context;
	},
	/** Shows this board's background in Settings; the returned function takes it away. */
	set(next: BoardBackgroundContext): () => void {
		context = next;
		return () => {
			if (context === next) context = undefined;
		};
	}
};
