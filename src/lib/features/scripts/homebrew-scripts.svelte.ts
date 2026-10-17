/**
 * The BOTC HomeBrew Wiki's scripts, fetched through our Worker only while Search shows that
 * source. The last list is kept on the device, so it is there offline and the next visit
 * shows it straight away (like `collection.svelte.ts`).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { withTimeout } from './fetch-script.ts';
import {
	HOMEBREW_SCRIPTS_API,
	readHomebrewList,
	type HomebrewScript
} from './homebrew-scripts-api.ts';

const STORAGE_KEY = 'grim-games.homebrew-scripts';

export type HomebrewStatus = 'idle' | 'loading' | 'ready' | 'error';

let list = $state.raw<HomebrewScript[]>([]);
let status = $state<HomebrewStatus>('idle');
let restored = false;
let loading: Promise<void> | undefined;

function restore(): void {
	if (restored) return;
	restored = true;
	try {
		const saved = readHomebrewList(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
		if (saved?.length) list = saved;
	} catch {
		// No storage, or an unreadable copy: fetched again when needed.
	}
}

export const homebrewScripts = {
	get list(): HomebrewScript[] {
		restore();
		return list;
	},
	get status(): HomebrewStatus {
		return status;
	},

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
		restore();
		if (status === 'ready') return Promise.resolve();
		loading ??= (async () => {
			status = 'loading';
			let response: Response;
			try {
				response = await fetch(HOMEBREW_SCRIPTS_API, { signal: withTimeout() });
			} catch {
				status = 'error';
				return;
			}
			const found = response.ok
				? readHomebrewList(await response.json().catch(() => undefined))
				: undefined;
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
