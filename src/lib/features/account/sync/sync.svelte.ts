/**
 * Account sync (Storage thread's plan, approved by Trevor 2026-10-18): each kind of user data
 * is a set of documents in the account. This device keeps its own copy, changes wait in an
 * outbox (so they survive going offline or closing the app), and one request at a time pushes
 * them and pulls what other devices changed since the last time.
 *
 * Features register their kind, read `docs(kind)`, and call `save` or `remove`; they never
 * talk to the server themselves. Each kind can be switched off in Settings > Data.
 */
/* eslint-disable svelte/prefer-svelte-reactivity -- the Maps here are working copies; what the
   UI reads is `visible`, replaced whole on every change ($state.raw). */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, accountApi } from '../account-api.ts';
import type { DocKind, ProfileDoc } from '../account-protocol.ts';
import { account } from '../account.svelte.ts';
import {
	collapse,
	nextBatch,
	resolveConflict,
	toChange,
	type ConflictRules,
	type OutboxEntry
} from './outbox.ts';
import * as store from './sync-db.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

/** Which kinds this device syncs (Settings > Data); a kind not listed is on. */
const SWITCHES_KEY = 'grim-games:sync-kinds:v1';
/** A change is sent this long after the last one, so a burst of edits goes in one request. */
const PUSH_DELAY_MS = 1000;
/** While the app is open, other devices' changes are fetched this often. */
const PULL_EVERY_MS = 5 * 60_000;
/** Requests in one sync at most, so a stuck loop can't run forever. */
const MAX_ROUNDS = 20;

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

type KindOptions = ConflictRules;

const kinds = new Map<DocKind, KindOptions>();
const key = (kind: DocKind, id: string) => `${kind}/${id}`;

/** This account's documents as last received, and its waiting changes, by `key`. */
let stored = new Map<string, ProfileDoc>();
let outbox = new Map<string, OutboxEntry>();
let loadedFor: string | undefined;
let loading: Promise<void> | undefined;

let visible = $state.raw<Map<DocKind, ProfileDoc[]>>(new Map());
let ready = $state(false);
/** This account's documents have been fetched at least once (on this device, ever). */
let pulled = $state(false);
let status = $state<SyncStatus>('idle');
let lastError = $state<string | undefined>(undefined);
let switches = $state<Partial<Record<DocKind, boolean>>>(readSwitches());

let running: Promise<void> | undefined;
let runAgain = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastChangedAt = 0;

function readSwitches(): Partial<Record<DocKind, boolean>> {
	const parsed = readStored(SWITCHES_KEY);
	return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

function isOn(kind: DocKind): boolean {
	return switches[kind] !== false;
}

/** What the device shows: the account's copy with any waiting change on top. */
function rebuild(): void {
	const all = new Map(stored);
	for (const [k, entry] of outbox) {
		const base = stored.get(k);
		all.set(k, {
			id: entry.id,
			kind: entry.kind,
			rev: base?.rev ?? 0,
			updatedAt: entry.changedAt,
			deleted: entry.deleted === true,
			...(entry.deleted ? {} : { body: entry.body })
		});
	}
	const byKind = new Map<DocKind, ProfileDoc[]>();
	for (const doc of all.values()) {
		if (doc.deleted) continue;
		byKind.set(doc.kind, [...(byKind.get(doc.kind) ?? []), doc]);
	}
	for (const list of byKind.values()) list.sort((a, b) => b.updatedAt - a.updatedAt);
	visible = byKind;
}

function withoutUser(doc: store.StoredDoc): ProfileDoc {
	const { userId, ...rest } = doc;
	void userId;
	return rest;
}

function load(userId: string): Promise<void> {
	if (loadedFor === userId) return Promise.resolve();
	loading ??= (async () => {
		const [docs, waiting, cursor] = await Promise.all([
			store.readDocs(userId),
			store.readOutbox(userId),
			store.readCursor(userId)
		]);
		if (account.user?.id !== userId) return;
		stored = new Map(docs.map((doc) => [key(doc.kind, doc.id), withoutUser(doc)]));
		outbox = new Map(waiting.map((entry) => [key(entry.kind, entry.id), entry]));
		loadedFor = userId;
		rebuild();
		pulled = cursor > 0;
		ready = true;
	})().finally(() => (loading = undefined));
	return loading;
}

function reset(): void {
	stored = new Map();
	outbox = new Map();
	loadedFor = undefined;
	visible = new Map();
	ready = false;
	pulled = false;
	status = 'idle';
	lastError = undefined;
}

function schedulePush(): void {
	clearTimeout(pushTimer);
	pushTimer = setTimeout(() => void accountSync.syncNow(), PUSH_DELAY_MS);
}

/** Queues a change to one item; `body` undefined deletes it. */
async function queue(kind: DocKind, id: string, body: unknown): Promise<void> {
	const user = account.user;
	if (!user || !isOn(kind)) return;
	await load(user.id);
	if (loadedFor !== user.id) return;
	const k = key(kind, id);
	lastChangedAt = Math.max(Date.now(), lastChangedAt + 1);
	const next: OutboxEntry = {
		userId: user.id,
		kind,
		id,
		baseRev: stored.get(k)?.rev ?? 0,
		queuedAt: lastChangedAt,
		changedAt: lastChangedAt,
		...(body === undefined ? { deleted: true } : { body })
	};
	const entry = collapse(outbox.get(k), next);
	outbox.set(k, entry);
	rebuild();
	await store.write(user.id, { putOutbox: [entry] });
	schedulePush();
}

/** One request: send the oldest waiting changes, take what other devices changed. */
async function round(userId: string): Promise<boolean> {
	const on = [...kinds.keys()].filter(isOn);
	const batch = nextBatch([...outbox.values()].filter((entry) => isOn(entry.kind)));
	if (on.length === 0 && batch.length === 0) return false;
	const since = await store.readCursor(userId);
	const response = await accountApi.sync({ since, changes: batch.map(toChange), kinds: on });
	if (account.user?.id !== userId || loadedFor !== userId) return false;

	const putDocs: ProfileDoc[] = [];
	const requeue: OutboxEntry[] = [];
	const deleteOutbox = batch.map(({ kind, id, changedAt }) => ({ kind, id, changedAt }));
	const failures: string[] = [];
	for (const result of response.results) {
		const sent = batch.find((entry) => entry.kind === result.kind && entry.id === result.id);
		if (result.status === 'saved') putDocs.push(result.doc);
		else if (result.status === 'conflict' && sent) {
			const copyId = crypto.randomUUID();
			const resolved = resolveConflict(
				toChange(sent),
				result.doc,
				copyId,
				kinds.get(result.kind),
				// The body both devices started from: this device's copy before the change.
				stored.get(key(result.kind, result.id))
			);
			putDocs.push(resolved.keep);
			if (resolved.requeue) {
				lastChangedAt = Math.max(Date.now(), lastChangedAt + 1);
				requeue.push({
					...resolved.requeue,
					userId,
					queuedAt: lastChangedAt,
					changedAt: lastChangedAt
				});
			}
		} else failures.push(result.status);
	}
	// Results first, then later changes from other devices; a newer revision always wins.
	for (const doc of response.changes) {
		const known = putDocs.find((d) => d.kind === doc.kind && d.id === doc.id);
		if (!known || known.rev <= doc.rev) putDocs.push(doc);
	}
	const newest = new Map<string, ProfileDoc>();
	for (const doc of putDocs) {
		const k = key(doc.kind, doc.id);
		const have = newest.get(k) ?? stored.get(k);
		if (!have || have.rev <= doc.rev) newest.set(k, doc);
	}

	await store.write(userId, {
		deleteOutbox,
		putOutbox: requeue,
		putDocs: [...newest.values()].map((doc) => ({ ...doc, userId })),
		cursor: response.cursor
	});
	for (const [k, doc] of newest) stored.set(k, doc);
	for (const { kind, id, changedAt } of deleteOutbox) {
		const k = key(kind, id);
		if (outbox.get(k)?.changedAt === changedAt) outbox.delete(k);
	}
	for (const entry of requeue) {
		const k = key(entry.kind, entry.id);
		// A change made while this request was out is newer: it goes on the server's revision.
		const waiting = outbox.get(k);
		outbox.set(k, waiting ? { ...waiting, baseRev: entry.baseRev } : entry);
	}
	rebuild();
	if (failures.length > 0) {
		lastError = failures.includes('too-many') ? 'too-many' : 'too-large';
		reportError(new Error(`Account sync refused: ${failures.join(', ')}`), {
			area: 'account',
			notify: false
		});
	}
	return response.more || (batch.length > 0 && [...outbox.values()].some((e) => isOn(e.kind)));
}

async function run(): Promise<void> {
	const user = account.user;
	if (!user) return;
	await load(user.id);
	status = 'syncing';
	lastError = undefined;
	try {
		for (let i = 0; i < MAX_ROUNDS && (await round(user.id)); i++);
		if (account.user?.id === user.id) {
			status = 'idle';
			pulled = true;
		}
	} catch (e) {
		if (e instanceof AccountApiError && e.status === 0) {
			status = 'offline';
		} else {
			status = 'error';
			lastError = e instanceof Error ? e.message : String(e);
			if (!(e instanceof AccountApiError)) reportError(e, { area: 'account', notify: false });
		}
	}
}

export const accountSync = {
	/** Called once per kind by the feature that owns it, before it saves anything. */
	register(kind: DocKind, options: KindOptions = {}): void {
		kinds.set(kind, options);
	},
	get kinds(): DocKind[] {
		return [...kinds.keys()];
	},
	/** The kind's items on this device (deleted ones left out), newest change first. */
	docs<T = unknown>(kind: DocKind): ProfileDoc<T>[] {
		return (visible.get(kind) ?? []) as ProfileDoc<T>[];
	},
	/** True once this account's copy on the device has been read. */
	get ready(): boolean {
		return ready;
	},
	/** True once this account's documents have been fetched, so an empty list means none. */
	get pulled(): boolean {
		return pulled;
	},
	get status(): SyncStatus {
		return status;
	},
	get error(): string | undefined {
		return lastError;
	},
	/** Resolves when this account's copy on the device has been read. */
	whenReady(): Promise<void> {
		const user = account.user;
		return user ? load(user.id) : Promise.resolve();
	},
	save(kind: DocKind, id: string, body: unknown): Promise<void> {
		return queue(kind, id, body ?? null);
	},
	remove(kind: DocKind, id: string): Promise<void> {
		return queue(kind, id, undefined);
	},
	/** Sends waiting changes and fetches other devices' now; resolves when done. */
	syncNow(): Promise<void> {
		if (running) {
			runAgain = true;
			return running;
		}
		running = (async () => {
			do {
				runAgain = false;
				await run();
			} while (runAgain);
		})().finally(() => (running = undefined));
		return running;
	},
	enabled(kind: DocKind): boolean {
		return isOn(kind);
	},
	/** Turning a kind back on fetches all of it again, since this device skipped its changes. */
	async setEnabled(kind: DocKind, on: boolean): Promise<void> {
		switches = { ...switches, [kind]: on };
		// No storage: the switch lasts until the page reloads.
		writeStored(SWITCHES_KEY, switches);
		const user = account.user;
		if (on && user) {
			await store.write(user.id, { cursor: 0 });
			await accountSync.syncNow();
		}
	}
};

account.onChange((user) => {
	clearTimeout(pushTimer);
	reset();
	if (user) void accountSync.syncNow();
});

if (typeof window !== 'undefined') {
	const pull = () => {
		if (account.user && document.visibilityState === 'visible') void accountSync.syncNow();
	};
	document.addEventListener('visibilitychange', pull);
	window.addEventListener('online', pull);
	setInterval(pull, PULL_EVERY_MS);
}
