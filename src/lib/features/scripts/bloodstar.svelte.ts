/**
 * Bloodstar Clocktica's published scripts, fetched through our Worker only while Search shows that
 * source. The last list is kept on the device, so it is there offline and the next visit
 * shows it straight away (like `collection.svelte.ts`).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { withTimeout } from './fetch-script.ts';
import { BLOODSTAR_API, readBloodstarList, type BloodstarScript } from './bloodstar-api.ts';

const STORAGE_KEY = 'grim-games.bloodstar-scripts';

export type BloodstarStatus = 'idle' | 'loading' | 'ready' | 'error';

let list = $state.raw<BloodstarScript[]>([]);
let status = $state<BloodstarStatus>('idle');
let restored = false;
let loading: Promise<void> | undefined;

function restore(): void {
	if (restored) return;
	restored = true;
	// No storage, or an unreadable copy: fetched again when needed.
	const saved = readBloodstarList(readStored(STORAGE_KEY));
	if (saved?.length) list = saved;
}

export const bloodstarScripts = {
	get list(): BloodstarScript[] {
		restore();
		return list;
	},
	get status(): BloodstarStatus {
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
				response = await fetch(BLOODSTAR_API, { signal: withTimeout() });
			} catch {
				status = 'error';
				return;
			}
			const found = response.ok
				? readBloodstarList(await response.json().catch(() => undefined))
				: undefined;
			// An empty list is a broken source: keep the last one.
			if (!found?.length) {
				status = 'error';
				if (response.ok && !found)
					reportError(new Error('Bloodstar scripts: unreadable answer'), {
						area: 'scripts',
						notify: false
					});
				return;
			}
			list = found;
			// No storage: fetched again next time.
			writeStored(STORAGE_KEY, { scripts: found });
			status = 'ready';
		})().finally(() => (loading = undefined));
		return loading;
	}
};
