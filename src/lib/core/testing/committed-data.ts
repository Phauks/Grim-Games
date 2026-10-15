/**
 * Test support only (never import from app code): the TPI data committed in static/data,
 * loaded with the same parsers the app uses. The rules tests in src/lib/core/abilities and
 * src/lib/core/jinxes read characters and jinxes from here.
 */
import { readFileSync } from 'node:fs';
import {
	loadGameData,
	type Character,
	type CharacterId,
	type GameData
} from '#lib/core/data/index.ts';

const dataDir = new URL('../../../../static/data/', import.meta.url);
const readJson = (file: string): unknown =>
	JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

let cached: GameData | undefined;

export function committedGameData(): GameData {
	cached ??= loadGameData({
		roles: readJson('roles.json'),
		jinxes: readJson('jinxes.json'),
		nightsheet: readJson('nightsheet.json')
	});
	return cached;
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
