/**
 * The Character Lab's choices, kept on this device (plans M37, M45): the setup, where in the
 * list of opponents it is and the game it last loaded. Stored with a version, so a newer build
 * reads what an older one saved; M37's Works and Problem marks, and M45's place for the opponent, are dropped (Trevor,
 * 2026-11-04: "remove works and error, just make the report button there").
 */
import type { LabFiller } from '#lib/core/lab/lab-game.ts';
import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:character-lab:v1';

export interface LabState {
	playerCount: number;
	locked: CharacterId[];
	/**
	 * The Characters table shows only characters jinxed with a locked one (plan M45), while
	 * one is locked. The opponents are always the table's rows as shown.
	 */
	jinxedOnly: boolean;
	/** Each game gets its setup reminders, chosen at random (Trevor, 2026-11-04). */
	setupTokens: boolean;
	/** Select character lists only characters with a jinx, or that change setup. */
	pickJinxed: boolean;
	pickSetup: boolean;
	filler: LabFiller;
	/** The opponent shown, as a place in the list of opponents. */
	index: number;
	/** The lab game last loaded, deleted when the next one loads. */
	gameId?: GameId;
}

export const DEFAULT_LAB: LabState = {
	playerCount: 12,
	locked: [],
	jinxedOnly: true,
	setupTokens: true,
	pickJinxed: false,
	pickSetup: false,
	filler: 'all',
	index: 0
};

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * Whether the table shows only jinxed characters. Saved by M45 as `jinxedOnly`; before it (M37)
 * the lab had an opponents drop-down, `source`, whose Jinxes choice is the same thing and whose
 * other choices (a type, every character, hand-picked) are now the table's own filters.
 */
function parseJinxedOnly(raw: Record<string, unknown>): boolean {
	if (typeof raw.jinxedOnly === 'boolean') return raw.jinxedOnly;
	if (isObject(raw.source)) return raw.source.kind === 'jinxes';
	return DEFAULT_LAB.jinxedOnly;
}

/** What was stored, or the defaults for anything missing or unreadable. */
export function parseLab(raw: unknown): LabState {
	if (!isObject(raw)) return { ...DEFAULT_LAB };
	const count = Number(raw.playerCount);
	return {
		playerCount: Number.isInteger(count) && count >= 1 && count <= 20 ? count : 12,
		locked: strings(raw.locked),
		jinxedOnly: parseJinxedOnly(raw),
		setupTokens: typeof raw.setupTokens === 'boolean' ? raw.setupTokens : DEFAULT_LAB.setupTokens,
		pickJinxed: raw.pickJinxed === true,
		pickSetup: raw.pickSetup === true,
		filler:
			raw.filler === 'all' || OFFICIAL_EDITIONS.some((e) => e.id === raw.filler)
				? (raw.filler as LabFiller)
				: DEFAULT_LAB.filler,
		index: Number.isInteger(raw.index) && (raw.index as number) >= 0 ? (raw.index as number) : 0,
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

/** The lab's own game on this device, kept out of Join game and History. */
export function labGameId(): GameId | undefined {
	return readParsed(KEY, parseLab).gameId;
}
