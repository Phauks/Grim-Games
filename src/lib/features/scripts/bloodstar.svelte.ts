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

/**
 * The copy kept on the device, read once when the module loads: reading it lazily from the
 * list's getter wrote state while a derived value was being worked out (Trevor, 2026-10-19).
 * No storage, or an unreadable copy: fetched again when needed.
 */
function restored(): BloodstarScript[] {
	return readBloodstarList(readStored(STORAGE_KEY)) ?? [];
}

let list = $state.raw<BloodstarScript[]>(restored());
let status = $state<BloodstarStatus>('idle');
let loading: Promise<void> | undefined;

export const bloodstarScripts = {
	get list(): BloodstarScript[] {
		return list;
	},
	get status(): BloodstarStatus {
		return status;
	},

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
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
