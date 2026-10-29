/**
 * Where the game is up to, for the board's corner and the room's phones (GrimoireBoard):
 * when Start game was tapped, the night or day in play, and the corner's lines.
 */
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import { gamePhase } from '#lib/core/rules/index.ts';
import { playersLine, standardPlayersLine } from '#lib/features/modes/players-line.ts';
import { savedChoiceFor } from '#lib/features/modes/script-choices.svelte.ts';
import { scriptVersion } from '#lib/features/player/player-script.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import { cornerLines } from './corner-lines.ts';
import { gameStarts, nightUnderway, type EndedGame } from './device-notes.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { phaseText } from './phase-text.ts';

/** What the status reads from the board, fresh on each call. */
export interface BoardStatusContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	/** This game's ending, if it has ended. */
	ended: EndedGame | undefined;
	/** Looking at another Storyteller's board: nothing is sent to the room. */
	watching: boolean;
	/** Phones watching this board's room. */
	watchers: number;
}

export class BoardStatus {
	/** Read again when Start game is tapped (started). */
	#startedRead = $state(0);
	#context: () => BoardStatusContext;

	constructor(context: () => BoardStatusContext) {
		this.#context = context;
		// Phones get the table's standard split, never the grimoire's: a Baron's extra
		// Outsiders are the Storyteller's to know (https://wiki.bloodontheclocktower.com/Baron).
		$effect(() => {
			const { game, watching } = this.#context();
			const corner = this.corner;
			if (!watching)
				roomHost().showCorner(game.gameId, {
					...corner,
					...(corner.players ? { players: standardPlayersLine(game.seating.length) } : {})
				});
		});
		// Players see where the game is up to, and the day timer during the day (Trevor,
		// 2026-10-26).
		$effect(() => {
			const { game, watching, ended } = this.#context();
			if (!watching) roomHost().showPhase(game.gameId, ended ? undefined : this.now);
		});
	}

	/** The first night started: when it did is read again. */
	started(): void {
		this.#startedRead += 1;
	}

	/** When Start game was tapped, for Game time in the corner. */
	readonly startedAt = $derived.by(() => {
		void this.#startedRead;
		return gameStarts.read(this.#context().game.gameId);
	});

	/**
	 * The night or day in play, for the corner (Trevor, 2026-10-23): Setup until Start game,
	 * then Night 1, and a night from End day (Dusk) until its Dawn starts the next day. A game
	 * with days played is past Setup even where this device has no start time (gamePhase).
	 */
	readonly now = $derived.by(() => {
		const { grimoire, game, ended } = this.#context();
		return gamePhase(game.pastDays.length, {
			begun: this.startedAt !== undefined,
			nightUnderway: ended
				? nightUnderway(
						{ day: grimoire.nightDay, done: grimoire.nightDone },
						game.pastDays.length,
						true
					)
				: grimoire.nightRunning || grimoire.nightUnderway
		});
	});

	readonly text = $derived(phaseText(this.now));

	/** The corner's lines, which the room's phones show too (Trevor, 2026-10-24). */
	readonly corner = $derived.by(() => {
		const { game, characters, ended, watching, watchers } = this.#context();
		return cornerLines({
			gameId: game.gameId,
			phase: this.now,
			startedAt: this.startedAt,
			endedAt: ended?.endedAt,
			watchers,
			watching,
			version: scriptVersion(undefined, game.script.meta) ?? savedChoiceFor(game.script)?.version,
			players: playersLine(game, characters)
		});
	});
}
