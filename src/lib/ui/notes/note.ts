/**
 * A titled note as the note list and editor show it: a player's notebook note
 * (`features/player/notebook.ts`) and the Storyteller's game notes (`Game.notes`) share this
 * shape, so both use the same list and editor (Trevor, 2026-10-23: "match parity of player
 * note functionality").
 */
export interface TitledNote {
	noteId: string;
	/** Empty until it is named. */
	title: string;
	text: string;
	/** The list shows the title only; the text shows when the note is opened. */
	hidden: boolean;
}
