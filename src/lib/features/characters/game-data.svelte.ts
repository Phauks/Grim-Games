import {
	loadGameData,
	parseNumericNightOrder,
	type GameData,
	type NumericNightOrder
} from '#lib/core/data/index.ts';
import {
	characterNames,
	NO_CHARACTER_NAMES,
	type CharacterNames
} from '#lib/core/rules/character-names.ts';

/**
 * Official character data, fetched once from the synced files in `static/data/` (the
 * service worker precaches them, so this works offline).
 */
let data = $state<GameData | undefined>(undefined);
let loading: Promise<GameData> | undefined;

async function fetchJson(path: string): Promise<unknown> {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
	return response.json();
}

export function loadOfficialData(): Promise<GameData> {
	loading ??= Promise.all([
		fetchJson('/data/roles.json'),
		fetchJson('/data/jinxes.json'),
		fetchJson('/data/nightsheet.json')
	]).then(([roles, jinxes, nightsheet]) => (data = loadGameData({ roles, jinxes, nightsheet })));
	return loading;
}

export const officialData = {
	get current() {
		return data;
	}
};

let names: { for: GameData; names: CharacterNames } | undefined;

/**
 * Official character names, for drawing every name in text as a badge. Matches nothing
 * until the data has loaded (reactive: reads `officialData`).
 */
export function officialNames(): CharacterNames {
	const current = data;
	if (!current) return NO_CHARACTER_NAMES;
	if (names?.for !== current) names = { for: current, names: characterNames(current.characters) };
	return names.names;
}

let numericLoading: Promise<NumericNightOrder> | undefined;

/**
 * The provisional numeric night order (`night-order-provisional.json`), used to slot
 * homebrew night numbers and shown on the Character reference page. Fetched on demand.
 */
export function loadNumericNightOrder(): Promise<NumericNightOrder> {
	numericLoading ??= fetchJson('/data/night-order-provisional.json').then(parseNumericNightOrder);
	return numericLoading;
}
