/**
 * What players see of a script: characters grouped by type, the jinxes between them, and
 * the night order with TPI's night text (Trevor, 2026-10-15). Built from core's script, jinx and
 * night-order rules; nothing here is authored rules text.
 */
import {
	CHARACTER_TYPES,
	type Character,
	type CharacterType,
	type GameData,
	type LoadedScript,
	type NightMarker,
	type NumericNightOrder
} from '#lib/core/data/index.ts';
import { MAX_DEALT_PLAYERS } from '#lib/core/rules/distribution.ts';
import { scriptJinxes, type ScriptJinx } from '#lib/core/rules/jinxes.ts';
import { isNightMarker, nightOrder, type Night } from '#lib/core/rules/night-order.ts';
import { hasEvilTeamInfo } from '#lib/core/rules/teensyville.ts';

export interface TypeGroup {
	type: CharacterType;
	characters: Character[];
}

/** The script's characters by type, in the game's type order, script order within a type. */
export function groupByType(characters: readonly Character[]): TypeGroup[] {
	return CHARACTER_TYPES.map((type) => ({
		type,
		characters: characters.filter((c) => c.type === type)
	})).filter((g) => g.characters.length > 0);
}

/**
 * The characters on the player's script sheet: the script's own, plus, for an official
 * edition, its Travellers, which TPI recommends for that edition though they are not on its
 * character sheet (Trevor, 2026-10-16). A custom script's Travellers are the ones it lists.
 */
export function sheetCharacters(script: LoadedScript, data: GameData): Character[] {
	if (!script.edition) return [...script.characters];
	const listed = new Set(script.characters.map((c) => c.id));
	const travellers = data.characters.filter(
		(c) => c.edition === script.edition && c.type === 'traveller' && !listed.has(c.id)
	);
	return [...script.characters, ...travellers];
}

export function playerJinxes(script: LoadedScript, data: GameData): ScriptJinx[] {
	return scriptJinxes(
		data.jinxes,
		script.characters.map((c) => c.id),
		script.homebrewJinxes
	);
}

export type PlayerNightEntry =
	| { kind: 'marker'; id: NightMarker }
	| {
			kind: 'character';
			character: Character;
			/** TPI's night text for this step (the character's night reminder). */
			text?: string;
	  };

export interface PlayerNight {
	night: Night;
	entries: PlayerNightEntry[];
	/**
	 * False when Minion and Demon info do not happen at this player count. They stay in the
	 * list (shown dimmed) so the list never changes length as seats are added.
	 */
	evilInfo: boolean;
}

/**
 * The night order for players: every character on the script that wakes this night, in
 * order, with Dusk, Minion info, Demon info and Dawn. Uses the script's own `_meta` order
 * when it has one.
 */
export function playerNight(
	script: LoadedScript,
	data: GameData,
	night: Night,
	players: number,
	numeric?: NumericNightOrder
): PlayerNight {
	const order = nightOrder({
		night,
		sheet: data.nightSheet,
		inPlay: script.characters,
		// Always lay out Minion and Demon info; `evilInfo` says whether they happen.
		players: MAX_DEALT_PLAYERS,
		customOrder: night === 'first' ? script.meta.firstNight : script.meta.otherNight,
		numeric
	});
	const entries: PlayerNightEntry[] = [];
	for (const step of order.steps) {
		if (step.kind === 'marker' && isNightMarker(step.id))
			entries.push({ kind: 'marker', id: step.id });
		else if (step.kind === 'character' && step.character)
			entries.push({ kind: 'character', character: step.character, text: step.reminder });
	}
	return {
		night,
		entries,
		evilInfo:
			night === 'first' &&
			hasEvilTeamInfo(
				players,
				script.characters.map((c) => c.id)
			)
	};
}
