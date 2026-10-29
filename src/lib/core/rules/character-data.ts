/**
 * Everything the app reads about one official character, gathered from each data file that
 * holds a piece of it, for the Character reference's Data view (Trevor, 2026-10-28: "a button
 * to show all information our app would use to use the character"). Each piece keeps the
 * file it comes from, so the view shows where to change it. Built at runtime from the same
 * data the app runs on, never a copy.
 *
 * What is not here: rules code that still names a character instead of reading its rules
 * block, which is code and not data.
 */
import { characterIcons, ICONS_PATH } from '#lib/core/data/icons.ts';
import type { GameData } from '#lib/core/data/game-data.ts';
import { jinxesFor } from '#lib/core/data/jinxes.ts';
import { rulesFileOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';

/** The pieces, in the order shown: TPI's files first, then ours. */
export const CHARACTER_DATA_PARTS = [
	'character',
	'rules',
	'nightSheet',
	'jinxes',
	'icons'
] as const;
export type CharacterDataPart = (typeof CHARACTER_DATA_PARTS)[number];

export interface CharacterDataSource {
	part: CharacterDataPart;
	/** The file it is read from, as a path in the repository. */
	file: string;
	/** What that file holds for this character; `null` when it holds nothing for it. */
	data: unknown;
}

export interface CharacterData {
	id: CharacterId;
	sources: CharacterDataSource[];
}

const FILES: Readonly<Record<CharacterDataPart, string>> = {
	character: 'static/data/roles.json',
	rules: 'src/lib/core/data/rules/{id}.json',
	nightSheet: 'static/data/nightsheet.json',
	jinxes: 'static/data/jinxes.json',
	icons: `static${ICONS_PATH}`
};

/** 1-based place on the night sheet, counting Dusk as #1 (as the reference table shows it). */
function sheetPlace(list: readonly string[], id: CharacterId): number | null {
	const i = list.indexOf(id);
	return i < 0 ? null : i + 1;
}

/** Every piece of data for `id`, or undefined when it is not an official character. */
export function characterData(data: GameData, id: CharacterId): CharacterData | undefined {
	const character = data.byId.get(id);
	if (!character) return undefined;
	const pieces: Record<CharacterDataPart, unknown> = {
		character,
		rules: rulesFileOf(id) ?? null,
		nightSheet: {
			firstNight: sheetPlace(data.nightSheet.firstNight, id),
			otherNight: sheetPlace(data.nightSheet.otherNight, id)
		},
		jinxes: jinxesFor(data.jinxes, id),
		icons: characterIcons(character) ?? null
	};
	return {
		id,
		sources: CHARACTER_DATA_PARTS.map((part) => ({
			part,
			file: FILES[part].replace('{id}', id),
			data: pieces[part]
		}))
	};
}

/** The whole of it as one JSON file: each piece under its name, with the file it came from. */
export function characterDataFile(data: CharacterData): Record<string, unknown> {
	const out: Record<string, unknown> = { id: data.id };
	for (const { part, file, data: value } of data.sources) out[part] = { file, data: value };
	return out;
}
