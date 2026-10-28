import {
	loadGameData,
	parseNumericNightOrder,
	type GameData,
	type NumericNightOrder
} from '#lib/core/data/index.ts';
import { fetchWithTimeout, SLOW_FETCH_TIMEOUT_MS } from '#lib/ui/fetch.ts';

/**
 * Official character data, fetched once from the synced files in `static/data/` (the
 * service worker precaches them, so this works offline).
 */
let data = $state<GameData | undefined>(undefined);
let loading: Promise<GameData> | undefined;

async function fetchJson(path: string): Promise<unknown> {
	// The character data is the largest file the app reads.
	const response = await fetchWithTimeout(path, { timeoutMs: SLOW_FETCH_TIMEOUT_MS });
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

let numericLoading: Promise<NumericNightOrder> | undefined;

/**
 * The provisional numeric night order (`night-order-provisional.json`), used to slot
 * homebrew night numbers and shown on the Character reference page. Fetched on demand.
 */
export function loadNumericNightOrder(): Promise<NumericNightOrder> {
	numericLoading ??= fetchJson('/data/night-order-provisional.json').then(parseNumericNightOrder);
	return numericLoading;
}
