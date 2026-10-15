/**
 * Test support only (never import from app code): the TPI data committed in static/data,
 * loaded with the same parsers the app uses. The rules tests in src/lib/core/abilities,
 * src/lib/core/jinxes and src/lib/core/rules read characters and jinxes from here.
 * Uses `node:fs`, so `src/lib/core/testing/` is excluded from the Worker typecheck.
 */
import { readFileSync } from 'node:fs';
import {
	loadGameData,
	parseNumericNightOrder,
	type Character,
	type CharacterId,
	type GameData,
	type NumericNightOrder
} from '#lib/core/data/index.ts';

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
	return cached;
}

let cachedNumeric: NumericNightOrder | undefined;

/** The provisional numeric night order (night-order-provisional.json). */
export function committedNumericNightOrder(): NumericNightOrder {
	cachedNumeric ??= parseNumericNightOrder(readDataFile('night-order-provisional.json'));
	return cachedNumeric;
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
