/**
 * The Character Lab's choices, kept on this device (plans M37, M45, M47): the core character,
 * the setup, where in the list of opponents it is and the game it last loaded. Stored with a
 * version, so a newer build reads what an older one saved. Dropped on read: M37's Works and
 * Problem marks (Trevor, 2026-11-04: "remove works and error"), M45's place for the opponent
 * and jinx filter, and every locked character after the first, which becomes the core one
 * (Trevor, 2026-11-05: "the whole lock system is weird").
 */
import type { LabFiller } from '#lib/core/lab/lab-game.ts';
import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:character-lab:v1';

export interface LabState {
	playerCount: number;
	/** The character under test; none until one is picked. */
	core?: CharacterId;
	/** Each game gets its setup reminders, chosen at random (Trevor, 2026-11-04). */
	setupTokens: boolean;
	/** Select character lists only characters with a jinx, or that change setup. */
	pickJinxed: boolean;
	pickSetup: boolean;
	filler: LabFiller;
	/** Where the game opens: 0 the first night, else that day (Trevor, 2026-11-05). */
	startDay: number;
	/** The opponent shown, as a place in the list of opponents. */
	index: number;
	/** The lab game last loaded, deleted when the next one loads. */
	gameId?: GameId;
}

export const DEFAULT_LAB: LabState = {
	playerCount: 12,
	setupTokens: true,
	pickJinxed: false,
	pickSetup: false,
	filler: 'all',
	startDay: 0,
	index: 0
};

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** What was stored, or the defaults for anything missing or unreadable. */
export function parseLab(raw: unknown): LabState {
	if (!isObject(raw)) return { ...DEFAULT_LAB };
	const count = Number(raw.playerCount);
	// M45 and before kept a list of locked characters.
	const core = typeof raw.core === 'string' ? raw.core : strings(raw.locked)[0];
	return {
		playerCount: Number.isInteger(count) && count >= 1 && count <= 20 ? count : 12,
		setupTokens: typeof raw.setupTokens === 'boolean' ? raw.setupTokens : DEFAULT_LAB.setupTokens,
		pickJinxed: raw.pickJinxed === true,
		pickSetup: raw.pickSetup === true,
		filler:
			raw.filler === 'all' || OFFICIAL_EDITIONS.some((e) => e.id === raw.filler)
				? (raw.filler as LabFiller)
				: DEFAULT_LAB.filler,
		startDay:
			Number.isInteger(raw.startDay) &&
			(raw.startDay as number) >= 0 &&
			(raw.startDay as number) <= 3
				? (raw.startDay as number)
				: 0,
		index: Number.isInteger(raw.index) && (raw.index as number) >= 0 ? (raw.index as number) : 0,
		...(core ? { core } : {}),
		...(typeof raw.gameId === 'string' ? { gameId: raw.gameId as GameId } : {})
	};
}

class LabChoices {
	#state = $state<LabState>(readParsed(KEY, parseLab));

	get current(): LabState {
		return this.#state;
	}

	update(change: Partial<LabState>): void {
		this.#state = { ...this.#state, ...change };
		writeStored(KEY, this.#state);
	}
}

export const lab = new LabChoices();

/** The lab's own game on this device, kept out of Continue game and History. */
export function labGameId(): GameId | undefined {
	return readParsed(KEY, parseLab).gameId;
}
