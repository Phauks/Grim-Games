/**
 * The official site's curated scripts, fetched through our Worker only when the picker
 * needs them (the Curated source is chosen, or a search is typed). The last list is kept
 * on the device, so it is there offline and the next visit shows it straight away.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { fetchJson } from '#lib/ui/fetch.ts';
import { CURATED_API, readCuratedList, type CuratedScript } from './curated-api.ts';

const STORAGE_KEY = 'grim-games.curated-scripts';

export type CuratedStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The copy kept on the device, read once when the module loads: reading it lazily from the
 * list's getter wrote state while a derived value was being worked out (Trevor, 2026-10-19).
 */
function restored(): CuratedScript[] {
	try {
		return readCuratedList(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? [];
	} catch {
		// No storage, or an unreadable copy: fetched again when needed.
		return [];
	}
}

let list = $state.raw<CuratedScript[]>(restored());
let status = $state<CuratedStatus>('idle');
let loading: Promise<void> | undefined;

function keep(scripts: CuratedScript[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ scripts }));
	} catch {
		// No storage: the list is fetched again next time.
	}
}

export const curatedScripts = {
	get list(): CuratedScript[] {
		return list;
	},
	get status(): CuratedStatus {
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
				({ response, body } = await fetchJson(CURATED_API));
			} catch {
				// Offline: expected, and the kept list still shows.
				status = 'error';
				return;
			}
			// The official site being down is expected too; an answer we can't read is a bug.
			const found = response.ok ? readCuratedList(body) : undefined;
			if (!found) {
				status = 'error';
				if (response.ok)
					reportError(new Error('Curated scripts: unreadable answer'), {
						area: 'scripts',
						notify: false
					});
				return;
			}
			list = found;
			keep(found);
			status = 'ready';
		})().finally(() => (loading = undefined));
		return loading;
	}
};
