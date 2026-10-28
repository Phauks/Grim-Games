/**
 * A list of scripts from one of the Scripts page's sources, fetched through our Worker only
 * when the page needs it. The last list is kept on the device, so it is there offline and the
 * next visit shows it straight away.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { fetchJson } from '#lib/ui/fetch.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export type CachedListStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CachedListSource<T> {
	/** The localStorage key the last list is kept under. */
	key: string;
	url: string;
	/** The list in an answer (and in the kept copy, `{ scripts }`); undefined when unreadable. */
	read: (raw: unknown) => T[] | undefined;
	/** Names the source in the report of an unreadable answer. */
	name: string;
	/** An empty answer is a broken source, so the last list stays (all but Curated). */
	emptyIsBroken?: boolean;
	/** How long to wait for an answer; `FETCH_TIMEOUT_MS` when absent. */
	timeoutMs?: number;
}

export class CachedList<T> {
	/**
	 * The kept copy is read once, here: reading it lazily from the getter wrote state while a
	 * derived value was being worked out (Trevor, 2026-10-19). No storage, or an unreadable
	 * copy: fetched again when needed.
	 */
	#list = $state.raw<T[]>([]);
	#status = $state<CachedListStatus>('idle');
	#loading: Promise<void> | undefined;

	constructor(private readonly source: CachedListSource<T>) {
		this.#list = source.read(readStored(source.key)) ?? [];
	}

	get list(): T[] {
		return this.#list;
	}

	get status(): CachedListStatus {
		return this.#status;
	}

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
		if (this.#status === 'ready') return Promise.resolve();
		this.#loading ??= this.#fetch().finally(() => (this.#loading = undefined));
		return this.#loading;
	}

	async #fetch(): Promise<void> {
		const { url, read, name, emptyIsBroken, timeoutMs } = this.source;
		this.#status = 'loading';
		let response: Response;
		let body: unknown;
		try {
			({ response, body } = await fetchJson(url, { timeoutMs }));
		} catch {
			// Offline: expected, and the kept list still shows.
			this.#status = 'error';
			return;
		}
		// The source being down is expected too; an answer we can't read is a bug.
		const found = response.ok ? read(body) : undefined;
		if (!found || (emptyIsBroken && found.length === 0)) {
			this.#status = 'error';
			if (response.ok && !found)
				reportError(new Error(`${name}: unreadable answer`), { area: 'scripts', notify: false });
			return;
		}
		this.#list = found;
		// No storage: fetched again next time.
		writeStored(this.source.key, { scripts: found });
		this.#status = 'ready';
	}
}
