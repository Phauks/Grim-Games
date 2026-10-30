import { untrack } from 'svelte';
import { toSavedGame } from '#lib/core/engine/index.ts';
import type { SharedGrimoire } from '#lib/core/sync/room.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { storedNotes, type BoardNotes } from '#lib/features/room/board-notes.ts';
import { REPORT_LIMITS } from './reports-protocol.ts';

/**
 * The game a report is sent from (Trevor, 2026-10-30: "we should allow sending the file, even
 * if mid-game. so we can exactly walk through"). Game screens offer their open game while they
 * are mounted; the Report form offers it with a switch, off until the Storyteller turns it on,
 * since it holds the players' names and the Storyteller's notes. An admin opens it as a game
 * of their own and steps through its History (ReportsInbox).
 */
type Offer = () => OpenGame | undefined;

let offers: Offer[] = [];

/**
 * Offers the game `get` returns to reports while the calling component is mounted. Call it
 * during component setup, like `$effect`.
 */
export function offerGameToReports(get: Offer): void {
	$effect(() => {
		untrack(() => (offers = [...offers, get]));
		return () => {
			offers = offers.filter((offer) => offer !== get);
		};
	});
}

/**
 * The game file: the saved game with its whole History (as the device saves it) and where the
 * board draws its seats and reminders, the same parts a room transfer brings (keepGrimoire).
 */
export type ReportGameFile = Pick<SharedGrimoire, 'saved' | keyof BoardNotes>;

/** The game attached to a report: its script's name, and the game file as JSON. */
export interface ReportGame {
	name: string;
	json: string;
}

/**
 * The game a report sent now could carry: undefined when no game is open, 'too-large' when
 * its file is over the limit.
 */
export function reportGame(): ReportGame | 'too-large' | undefined {
	for (let i = offers.length - 1; i >= 0; i--) {
		const open = offers[i]();
		if (!open) continue;
		const file: ReportGameFile = {
			saved: toSavedGame(open.session, Date.now()) as unknown as Record<string, unknown>,
			...storedNotes(open.game.gameId)
		};
		const json = JSON.stringify(file);
		if (json.length > REPORT_LIMITS.game) return 'too-large';
		return { name: open.game.script.meta?.name ?? '', json };
	}
	return undefined;
}
