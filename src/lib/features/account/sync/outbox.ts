/**
 * The device side of account sync, as plain data (Storage thread's plan, Trevor 2026-10-18):
 * changes wait in an outbox until they reach the account, and a conflict never loses a change.
 * `sync.svelte.ts` keeps these in IndexedDB and talks to the server.
 */
import {
	MAX_SYNC_BYTES,
	MAX_SYNC_CHANGES,
	type DocKind,
	type ProfileDoc,
	type SyncChange
} from '../account-protocol.ts';

/**
 * A change waiting to reach the account. `baseRev` is the revision it was made on;
 * `queuedAt` orders the outbox, and `changedAt` tells a newer change to the same item apart.
 */
export interface OutboxEntry extends SyncChange {
	userId: string;
	queuedAt: number;
	changedAt: number;
}

/**
 * Adds a change for an item that may already be waiting: the newer body (or delete) replaces
 * the waiting one, but keeps its `baseRev`, the revision the device last had from the account.
 */
export function collapse(waiting: OutboxEntry | undefined, next: OutboxEntry): OutboxEntry {
	if (!waiting) return next;
	const { userId, kind, id, changedAt } = next;
	const base = {
		userId,
		kind,
		id,
		changedAt,
		queuedAt: waiting.queuedAt,
		baseRev: waiting.baseRev
	};
	return next.deleted ? { ...base, deleted: true } : { ...base, body: next.body };
}

/** The oldest waiting changes that fit in one sync request. */
export function nextBatch(entries: readonly OutboxEntry[]): OutboxEntry[] {
	const batch: OutboxEntry[] = [];
	let bytes = 0;
	for (const entry of [...entries].sort((a, b) => a.queuedAt - b.queuedAt)) {
		if (batch.length >= MAX_SYNC_CHANGES) break;
		bytes += JSON.stringify(entry.body ?? null).length + 200;
		if (batch.length > 0 && bytes > MAX_SYNC_BYTES) break;
		batch.push(entry);
	}
	return batch;
}

/** The change as sent to the server. */
export function toChange({ kind, id, baseRev, body, deleted }: OutboxEntry): SyncChange {
	return deleted ? { kind, id, baseRev, deleted: true } : { kind, id, baseRev, body };
}

/** What the device does after the account refused a change because another device saved first. */
export interface Resolution {
	/** The account's copy, which the device now shows. */
	keep: ProfileDoc;
	/** A change to queue so this device's work isn't lost, if any. */
	requeue?: { kind: DocKind; id: string; baseRev: number; body?: unknown; deleted?: boolean };
}

/** How a kind settles both devices changing one item; see `resolveConflict`. */
export interface ConflictRules {
	/** The body of this device's copy when both are kept ("… (other device)"). */
	copy?: (body: unknown) => unknown;
	/**
	 * Combines both changes into one body instead of keeping both (Library labels, say).
	 * `base` is the body both started from, or undefined when the item was new here.
	 */
	merge?: (base: unknown, mine: unknown, theirs: unknown) => unknown;
}

/**
 * Never loses a change silently (the plan's Conflicts table):
 * - deleted here, changed there: the change wins and the item stays;
 * - changed here, deleted there: this device's version comes back;
 * - changed on both: the kind's `merge` combines them, or else both are kept, this
 *   device's as a copy under `copyId`, with `copy` applied to its body.
 */
export function resolveConflict(
	mine: SyncChange,
	server: ProfileDoc,
	copyId: string,
	rules: ConflictRules = {},
	base?: ProfileDoc
): Resolution {
	if (mine.deleted) return { keep: server };
	if (server.deleted) {
		return {
			keep: server,
			requeue: { kind: mine.kind, id: mine.id, baseRev: server.rev, body: mine.body }
		};
	}
	if (JSON.stringify(server.body) === JSON.stringify(mine.body)) return { keep: server };
	if (rules.merge) {
		const body = rules.merge(base?.deleted ? undefined : base?.body, mine.body, server.body);
		if (JSON.stringify(body) === JSON.stringify(server.body)) return { keep: server };
		return { keep: server, requeue: { kind: mine.kind, id: mine.id, baseRev: server.rev, body } };
	}
	const copy = rules.copy ?? ((body: unknown) => body);
	return {
		keep: server,
		requeue: { kind: mine.kind, id: copyId, baseRev: 0, body: copy(mine.body) }
	};
}
