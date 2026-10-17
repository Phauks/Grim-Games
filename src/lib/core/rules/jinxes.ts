/**
 * Jinxes on a script. If the script holds any jinxed pair, the Djinn is in play and every
 * jinx on the script is announced at the start, even for characters not in play
 * (https://wiki.bloodontheclocktower.com/Djinn). Some jinxes say only one of the pair can
 * be in play (Heretic with Baron, Godfather, Lleech, Pit-Hag, Spy, Widow:
 * https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes); those become setup
 * warnings when both are chosen.
 */
import type { JinxIndex } from '#lib/core/data/jinxes.ts';
import { pairKey } from '#lib/core/data/parse.ts';
import type { CharacterId, Jinx } from '#lib/core/data/types.ts';

export interface ScriptJinx extends Jinx {
	/** `official` from TPI's jinxes.json; `script` from a homebrew character's `jinxes`. */
	source: 'official' | 'script';
	/** The jinx forbids both characters being in play at once. */
	exclusive: boolean;
}

/** Jinx text meaning "only one of these can be in play". */
const EXCLUSIVE = /only (?:1|one) (?:jinxed )?character can be in play|cannot both be in play/i;

export function isExclusiveJinx(reason: string): boolean {
	return EXCLUSIVE.test(reason);
}

/**
 * Every jinx between characters on the script: TPI's, plus any declared by homebrew
 * characters. A homebrew jinx replaces TPI's for the same pair, since the script author
 * chose it. Order: TPI's data order, then the script's.
 */
export function scriptJinxes(
	index: JinxIndex,
	scriptIds: Iterable<CharacterId>,
	homebrewJinxes: readonly Jinx[] = []
): ScriptJinx[] {
	const ids = new Set(scriptIds);
	const own = new Map<string, Jinx>();
	for (const jinx of homebrewJinxes) {
		const [a, b] = jinx.characters;
		if (ids.has(a) && ids.has(b) && a !== b) own.set(pairKey(a, b), jinx);
	}
	const out: ScriptJinx[] = [];
	for (const jinx of index.all) {
		const [a, b] = jinx.characters;
		if (!ids.has(a) || !ids.has(b) || own.has(pairKey(a, b))) continue;
		out.push({ ...jinx, source: 'official', exclusive: isExclusiveJinx(jinx.reason) });
	}
	for (const jinx of own.values()) {
		out.push({ ...jinx, source: 'script', exclusive: isExclusiveJinx(jinx.reason) });
	}
	return out;
}

export interface JinxSetupWarning {
	characters: readonly [CharacterId, CharacterId];
	message: string;
	jinx: ScriptJinx;
}

/**
 * Setup warnings for exclusive jinxes where both characters were chosen. `names` turns ids
 * into display names.
 */
export function jinxSetupWarnings(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>,
	names: (id: CharacterId) => string = (id) => id
): JinxSetupWarning[] {
	const chosen = new Set(inPlay);
	return jinxes
		.filter((j) => j.exclusive && chosen.has(j.characters[0]) && chosen.has(j.characters[1]))
		.map((jinx) => {
			const [a, b] = jinx.characters;
			return {
				characters: jinx.characters,
				jinx,
				message: `${names(a)} and ${names(b)} are jinxed: only one of them can be in play.`
			};
		});
}

/** The jinxes that involve characters actually in play (for the grimoire, not the sheet). */
export function activeJinxes(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>
): ScriptJinx[] {
	const chosen = new Set(inPlay);
	return jinxes.filter((j) => chosen.has(j.characters[0]) && chosen.has(j.characters[1]));
}
