/**
 * Account sync's own database on this device (`grim-games-sync`): the outbox of changes
 * waiting to reach the account, the device's copy of the account's documents, and how far
 * it has pulled. Everything is kept per account, so two people on one device stay apart.
 */
import type { DocKind, ProfileDoc } from '../account-protocol.ts';
import type { OutboxEntry } from './outbox.ts';

/** Settings > Data clears it by this name. */
const SYNC_DB = 'grim-games-sync';
const DB_VERSION = 1;
const OUTBOX = 'outbox';
const DOCS = 'docs';
const CURSORS = 'cursors';

/** A document as this device has it: the account's copy, or this device's newer change. */
export interface StoredDoc extends ProfileDoc {
	userId: string;
}

let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	db ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(SYNC_DB, DB_VERSION);
		request.onupgradeneeded = () => {
			const opened = request.result;
			if (!opened.objectStoreNames.contains(OUTBOX))
				opened.createObjectStore(OUTBOX, { keyPath: ['userId', 'kind', 'id'] });
			if (!opened.objectStoreNames.contains(DOCS))
				opened.createObjectStore(DOCS, { keyPath: ['userId', 'kind', 'id'] });
			if (!opened.objectStoreNames.contains(CURSORS))
				opened.createObjectStore(CURSORS, { keyPath: 'userId' });
		};
		request.onsuccess = () => {
			const opened = request.result;
			opened.onversionchange = () => {
				opened.close();
				db = undefined;
			};
			resolve(opened);
		};
		request.onerror = () => {
			db = undefined;
			reject(request.error);
		};
	});
	return db;
}

function done(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

function result<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** All of one account's records in a store whose key starts with the user id. */
function forUser(userId: string): IDBKeyRange {
	return IDBKeyRange.bound([userId], [userId, []]);
}

export async function readOutbox(userId: string): Promise<OutboxEntry[]> {
	const tx = (await open()).transaction(OUTBOX);
	return result(tx.objectStore(OUTBOX).getAll(forUser(userId)) as IDBRequest<OutboxEntry[]>);
}

export async function readDocs(userId: string): Promise<StoredDoc[]> {
	const tx = (await open()).transaction(DOCS);
	return result(tx.objectStore(DOCS).getAll(forUser(userId)) as IDBRequest<StoredDoc[]>);
}

export async function readCursor(userId: string): Promise<number> {
	const tx = (await open()).transaction(CURSORS);
	const row = await result(
		tx.objectStore(CURSORS).get(userId) as IDBRequest<{ cursor: number } | undefined>
	);
	return row?.cursor ?? 0;
}

/** One transaction's worth of writes, so the outbox, documents and cursor never disagree. */
export interface SyncWrite {
	putOutbox?: OutboxEntry[];
	deleteOutbox?: { kind: DocKind; id: string; changedAt: number }[];
	putDocs?: StoredDoc[];
	cursor?: number;
}

export async function write(userId: string, change: SyncWrite): Promise<void> {
	const tx = (await open()).transaction([OUTBOX, DOCS, CURSORS], 'readwrite');
	const outbox = tx.objectStore(OUTBOX);
	for (const entry of change.putOutbox ?? []) outbox.put(entry);
	for (const { kind, id, changedAt } of change.deleteOutbox ?? []) {
		// Only the change that was sent: a newer one queued meanwhile stays to be sent next.
		const request = outbox.get([userId, kind, id]);
		request.onsuccess = () => {
			const waiting = request.result as OutboxEntry | undefined;
			if (waiting && waiting.changedAt === changedAt) outbox.delete([userId, kind, id]);
		};
	}
	for (const doc of change.putDocs ?? []) tx.objectStore(DOCS).put(doc);
	if (change.cursor !== undefined) tx.objectStore(CURSORS).put({ userId, cursor: change.cursor });
	await done(tx);
}
