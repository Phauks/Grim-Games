/**
 * The Character Lab's choices and results, kept on this device (plan M37): the setup, where in
 * the list of opponents it is, the game it last loaded, and a Works or Problem mark for each
 * pairing tried. Stored with a version, so a newer build reads what an older one saved.
 */
import {
	OPPONENT_PLACES,
	type LabFiller,
	type OpponentPlace,
	type OpponentSource
} from '#lib/core/lab/lab-game.ts';
import { CHARACTER_TYPES, OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
import type { CharacterId, CharacterType } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:character-lab:v1';

export const MARKS = ['works', 'problem'] as const;
export type Mark = (typeof MARKS)[number];

export interface LabState {
	playerCount: number;
	locked: CharacterId[];
	source: OpponentSource;
	place: OpponentPlace;
	filler: LabFiller;
	/** The opponent shown, as a place in the list of opponents. */
	index: number;
	/** The lab game last loaded, deleted when the next one loads. */
	gameId?: GameId;
	/** By `pairingKey`. */
	marks: Record<string, Mark>;
}

export const DEFAULT_LAB: LabState = {
	playerCount: 12,
	locked: [],
	source: { kind: 'jinxes' },
	place: 'in-play',
	filler: 'all',
	index: 0,
	marks: {}
};

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function parseSource(raw: unknown): OpponentSource {
	if (!isObject(raw)) return DEFAULT_LAB.source;
	if (raw.kind === 'all') return { kind: 'all' };
	if (raw.kind === 'picked') return { kind: 'picked', ids: strings(raw.ids) };
	if (raw.kind === 'type' && (CHARACTER_TYPES as readonly unknown[]).includes(raw.type))
		return { kind: 'type', type: raw.type as CharacterType };
	return { kind: 'jinxes' };
}

/** What was stored, or the defaults for anything missing or unreadable. */
export function parseLab(raw: unknown): LabState {
	if (!isObject(raw)) return { ...DEFAULT_LAB };
	const count = Number(raw.playerCount);
	const marks: Record<string, Mark> = {};
	if (isObject(raw.marks))
		for (const [key, mark] of Object.entries(raw.marks))
			if ((MARKS as readonly unknown[]).includes(mark)) marks[key] = mark as Mark;
	return {
		playerCount: Number.isInteger(count) && count >= 1 && count <= 20 ? count : 12,
		locked: strings(raw.locked),
		source: parseSource(raw.source),
		place: (OPPONENT_PLACES as readonly unknown[]).includes(raw.place)
			? (raw.place as OpponentPlace)
			: DEFAULT_LAB.place,
		filler:
			raw.filler === 'all' || OFFICIAL_EDITIONS.some((e) => e.id === raw.filler)
				? (raw.filler as LabFiller)
				: DEFAULT_LAB.filler,
		index: Number.isInteger(raw.index) && (raw.index as number) >= 0 ? (raw.index as number) : 0,
		...(typeof raw.gameId === 'string' ? { gameId: raw.gameId as GameId } : {}),
		marks
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
