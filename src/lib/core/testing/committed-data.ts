/**
 * Test support only (never import from app code): the TPI data committed in static/data,
 * loaded with the same parsers the app uses. The rules tests in src/lib/core/abilities,
 * src/lib/core/jinxes and src/lib/core/rules read characters and jinxes from here.
 * Uses `node:fs`, so `src/lib/core/testing/` is excluded from the Worker typecheck.
 */
import { readFileSync } from 'node:fs';
import {
	loadGameData,
	type Character,
	type CharacterId,
	type GameData
} from '#lib/core/data/index.ts';
import { sheetWithOwnPlaces } from '#lib/core/rules/night-order.ts';
import { HIDDEN_OFFICIAL_RULES } from './parity/official-rules.ts';

const dataDir = new URL('../../../../static/data/', import.meta.url);

/** Parsed JSON of a file in static/data. */
export function readDataFile(file: string): unknown {
	return JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));
}

let cached: GameData | undefined;

export function committedGameData(): GameData {
	cached ??= loadGameData({
		roles: readDataFile('roles.json'),
		jinxes: readDataFile('jinxes.json'),
		nightsheet: readDataFile('nightsheet.json')
	});
	if (process.env.GRIM_PARITY) cached = asCustom(cached);
	return cached;
}

/**
 * The parity run (M57, vitest.parity.config.ts): every official character as a custom one. No
 * edition, its rules block carried on the character as a script's custom character carries
 * `rules`, and no place on TPI's night sheet. TPI's jinx texts stay: a script's own jinxes
 * carry the same words, and their rules are in the characters' blocks.
 */
function asCustom(data: GameData): GameData {
	if (data.characters.every((c) => c.edition === undefined)) return data;
	const characters = data.characters.map((c): Character => {
		const custom: Character = { ...c };
		delete custom.edition;
		const rules = HIDDEN_OFFICIAL_RULES.get(c.id);
		return rules ? { ...custom, rules } : custom;
	});
	const markers = (night: readonly string[]) => night.filter((id) => !data.byId.has(id));
	return {
		...data,
		characters,
		byId: new Map(characters.map((c) => [c.id, c])),
		nightSheet: {
			firstNight: markers(data.nightSheet.firstNight),
			otherNight: markers(data.nightSheet.otherNight)
		}
	};
}

/** An official character by id; throws if roles.json has no such character. */
export function committedCharacter(id: CharacterId): Character {
	const character = committedGameData().byId.get(id);
	if (!character) throw new Error(`roles.json has no character "${id}"`);
	return character;
}

/** Whether TPI's night sheet lists the character on the first night and on other nights. */
export function nightSheetPresence(id: CharacterId): { firstNight: boolean; otherNight: boolean } {
	const { nightSheet } = committedGameData();
	return {
		firstNight: nightSheet.firstNight.includes(id),
		otherNight: nightSheet.otherNight.includes(id)
	};
}

/**
 * One night's order as the engine sees it: TPI's sheet with each character placed by its own
 * `nightOrder` where the sheet doesn't list it (M59), so a test of who wakes before whom holds
 * for official characters run as custom ones too.
 */
export function committedNightOrder(night: 'firstNight' | 'otherNight'): string[] {
	const data = committedGameData();
	const list = data.nightSheet[night];
	return sheetWithOwnPlaces(list, night === 'firstNight' ? 'first' : 'other', data.characters);
}
