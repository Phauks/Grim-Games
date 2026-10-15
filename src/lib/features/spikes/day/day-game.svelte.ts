import type { CharacterId, GameData } from '#lib/core/data/index.ts';
import {
	canUndo,
	dispatch,
	systemContext,
	undo,
	type Command,
	type EngineContext,
	type GameSession
} from '#lib/core/engine/index.ts';
import {
	characterLookup,
	type CharacterLookup,
	type DayEntry,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { sampleSession, type Variant } from './sample-games.ts';

/**
 * One sample game for the day spike, run through the real engine: commands, warnings
 * (shown as toasts, so nothing moves), and undo back to the end of the sample setup.
 */
export class DayGame {
	session = $state.raw<GameSession>() as GameSession;
	readonly characters: CharacterLookup;
	readonly #ctx: EngineContext;
	/** Undo stops here: the sample's setup is not the Storyteller's to undo. */
	readonly #floor: number;

	constructor(
		readonly variant: Variant,
		readonly data: GameData
	) {
		const ctx0 = systemContext(characterLookup(data, { entries: [] }));
		const session = sampleSession(variant, data, ctx0);
		this.characters = characterLookup(data, session.game.script);
		this.#ctx = systemContext(this.characters);
		this.session = session;
		this.#floor = session.log.cursor;
	}

	get game(): Game {
		return this.session.game;
	}

	/** Runs a command; warnings and refusals show as toasts. Returns whether it ran. */
	run(command: Command): boolean {
		const result = dispatch(this.session, command, this.#ctx);
		if (!result.ok) {
			toast('Not done', result.error.message);
			return false;
		}
		this.session = result.session;
		for (const warning of result.warnings) {
			if (warning.code !== 'no-change') toast('Note', warning.message);
		}
		return true;
	}

	get canUndo(): boolean {
		return canUndo(this.session) && this.session.log.cursor > this.#floor;
	}

	undo(): void {
		if (this.canUndo) this.session = undo(this.session);
	}

	seatName(seatId: SeatId | undefined): string {
		if (seatId === undefined) return '';
		return this.game.seats[seatId]?.playerName ?? 'Unknown seat';
	}

	characterName(id: CharacterId | undefined): string {
		return id === undefined ? '' : (this.characters.get(id)?.name ?? id);
	}

	/** A short line for a day-log entry, in our words. */
	describe(entry: DayEntry): string {
		switch (entry.kind) {
			case 'nomination':
				return `${this.seatName(entry.nominator)} nominated ${this.seatName(entry.nominee)}`;
			case 'execution':
				return `${this.seatName(entry.seatId)} executed${entry.died ? '' : ' (already dead)'}`;
			case 'ability':
				return `${this.characterName(entry.characterId)} (${this.seatName(entry.seatId)}) used their ability`;
			case 'note': {
				const who = entry.seatId ? ` (${this.seatName(entry.seatId)})` : '';
				const guesses = entry.guesses?.length
					? ` · ${entry.guesses.length} guess${entry.guesses.length === 1 ? '' : 'es'}`
					: '';
				return `${this.characterName(entry.characterId)}${who}: ${entry.text}${guesses}`;
			}
			case 'info':
				return `${this.characterName(entry.characterId)} (${this.seatName(entry.seatId)}): ${entry.text}`;
		}
	}
}
