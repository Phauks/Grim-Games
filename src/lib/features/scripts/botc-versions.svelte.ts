/**
 * Which versions BotC Scripts publishes for a script (Trevor, 2026-10-16/17: see whether a
 * saved version 12 has a newer one, and view previous versions while searching, loading or
 * saved). Asked through our Worker (`/api/botcscripts/versions/<n>`) once per page visit per
 * script, when its details are shown.
 *
 * Of the Scripts page's sources only BotC Scripts (and the World Cups, which load from it)
 * publishes versions. The official custom scripts page and the Carousel collection's Drive
 * files have no version history we can read; pasted and file scripts have none.
 *
 * For other screens (the Library, the Script builder): `botcVersions.load(n)` then
 * `botcVersions.get(n)` for the list, and `newerVersion(source)` for a saved script's badge.
 */
import { fetchJson } from '#lib/ui/fetch.ts';
import {
	compareVersions,
	readProxiedVersionList,
	versionsPath,
	type BotcScriptsVersionList
} from './botcscripts-api.ts';
import type { ScriptSource } from './saved-scripts.ts';

export type VersionsStatus = 'loading' | 'ready' | 'error';

const lists = $state<Record<number, BotcScriptsVersionList | undefined>>({});
const statuses = $state<Record<number, VersionsStatus | undefined>>({});

export const botcVersions = {
	get(scriptId: number): BotcScriptsVersionList | undefined {
		return lists[scriptId];
	},
	status(scriptId: number): VersionsStatus | undefined {
		return statuses[scriptId];
	},

	/** Asks once per page visit; a failure (offline, site down) is tried again next call. */
	async load(scriptId: number): Promise<void> {
		if (statuses[scriptId] === 'loading' || statuses[scriptId] === 'ready') return;
		statuses[scriptId] = 'loading';
		try {
			const { response, body } = await fetchJson(versionsPath(scriptId));
			const list = response.ok ? readProxiedVersionList(body) : undefined;
			if (!list) throw new Error('no version list');
			lists[scriptId] = list;
			statuses[scriptId] = 'ready';
		} catch {
			// Offline or the site down: expected, and the versions simply aren't offered.
			statuses[scriptId] = 'error';
		}
	}
};

/** The newer version BotC Scripts has for a saved script, once its list has loaded. */
export function newerVersion(source: ScriptSource): string | undefined {
	if (source.kind !== 'botcscripts' || !source.version) return undefined;
	const latest = botcVersions.get(source.scriptId)?.latest;
	return latest && compareVersions(latest, source.version) > 0 ? latest : undefined;
}
