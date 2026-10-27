/**
 * The BOTC HomeBrew Wiki's scripts, fetched through our Worker only while Search shows that
 * source. The last list is kept on the device, so it is there offline and the next visit
 * shows it straight away (like `collection.svelte.ts`).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { fetchJson } from '#lib/ui/fetch.ts';
import {
	HOMEBREW_SCRIPTS_API,
	readHomebrewList,
	type HomebrewScript
} from './homebrew-scripts-api.ts';

const STORAGE_KEY = 'grim-games.homebrew-scripts';

export type HomebrewStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The copy kept on the device, read once when the module loads: reading it lazily from the
 * list's getter wrote state while a derived value was being worked out (Trevor, 2026-10-19).
 */
function restored(): HomebrewScript[] {
	try {
		return readHomebrewList(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? [];
	} catch {
		// No storage, or an unreadable copy: fetched again when needed.
		return [];
	}
}

let list = $state.raw<HomebrewScript[]>(restored());
let status = $state<HomebrewStatus>('idle');
let loading: Promise<void> | undefined;

export const homebrewScripts = {
	get list(): HomebrewScript[] {
		return list;
	},
	get status(): HomebrewStatus {
		return status;
	},

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
		if (status === 'ready') return Promise.resolve();
		loading ??= (async () => {
			status = 'loading';
			let response: Response;
			let body: unknown;
			try {
				({ response, body } = await fetchJson(HOMEBREW_SCRIPTS_API));
			} catch {
				status = 'error';
				return;
			}
			const found = response.ok ? readHomebrewList(body) : undefined;
			// An empty list is a broken source: keep the last one.
			if (!found?.length) {
				status = 'error';
				if (response.ok && !found)
					reportError(new Error('Homebrew Wiki scripts: unreadable answer'), {
						area: 'scripts',
						notify: false
					});
				return;
			}
			list = found;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ scripts: found }));
			} catch {
				// No storage: fetched again next time.
			}
			status = 'ready';
		})().finally(() => (loading = undefined));
		return loading;
	}
};
