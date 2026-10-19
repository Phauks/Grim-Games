import { describe, expect, it } from 'vitest';
import { MAX_SYNC_CHANGES, type ProfileDoc } from '../account-protocol.ts';
import { collapse, nextBatch, resolveConflict, toChange, type OutboxEntry } from './outbox.ts';

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
	userId: 'u',
	kind: 'script',
	id: 'a',
	baseRev: 2,
	body: { name: 'one' },
	queuedAt: 10,
	changedAt: 10,
	...over
});
const doc = (over: Partial<ProfileDoc> = {}): ProfileDoc => ({
	id: 'a',
	kind: 'script',
	rev: 3,
	updatedAt: 1,
	deleted: false,
	body: { name: 'theirs' },
	...over
});

describe('collapse', () => {
	it('keeps the revision the first change was made on, with the newest body', () => {
		const next = entry({ baseRev: 5, body: { name: 'two' }, queuedAt: 20, changedAt: 20 });
		expect(collapse(entry(), next)).toEqual(entry({ body: { name: 'two' }, changedAt: 20 }));
		expect(collapse(undefined, next)).toBe(next);
	});
	it('turns into a delete when the item is deleted after a change', () => {
		const deleted = entry({ body: undefined, deleted: true, queuedAt: 20, changedAt: 20 });
		expect(collapse(entry(), deleted)).toEqual({
			userId: 'u',
			kind: 'script',
			id: 'a',
			baseRev: 2,
			queuedAt: 10,
			changedAt: 20,
			deleted: true
		});
	});
});

describe('nextBatch', () => {
	it('sends the oldest changes first, at most a request’s worth', () => {
		const entries = Array.from({ length: MAX_SYNC_CHANGES + 5 }, (_, i) =>
			entry({ id: `id${i}`, queuedAt: 1000 - i })
		);
		const batch = nextBatch(entries);
		expect(batch).toHaveLength(MAX_SYNC_CHANGES);
		expect(batch[0].id).toBe(`id${MAX_SYNC_CHANGES + 4}`);
	});
	it('always sends at least one change, however large', () => {
		const big = entry({ body: 'x'.repeat(5_000_000) });
		expect(nextBatch([big, entry({ id: 'b', queuedAt: 11 })])).toEqual([big]);
	});
	it('sends only what the server reads', () => {
		expect(toChange(entry())).toEqual({
			kind: 'script',
			id: 'a',
			baseRev: 2,
			body: { name: 'one' }
		});
		expect(toChange(entry({ deleted: true }))).toEqual({
			kind: 'script',
			id: 'a',
			baseRev: 2,
			deleted: true
		});
	});
});

describe('resolveConflict', () => {
	const mine = toChange(entry());
	it('keeps both when both devices changed the item', () => {
		expect(
			resolveConflict(mine, doc(), 'copy', { copy: (b) => ({ ...(b as object), copy: true }) })
		).toEqual({
			keep: doc(),
			requeue: { kind: 'script', id: 'copy', baseRev: 0, body: { name: 'one', copy: true } }
		});
	});
	it('needs nothing when both made the same change', () => {
		expect(resolveConflict(mine, doc({ body: { name: 'one' } }), 'copy')).toEqual({
			keep: doc({ body: { name: 'one' } })
		});
	});
	it('lets a change win over a delete, either way round', () => {
		expect(resolveConflict({ ...mine, body: undefined, deleted: true }, doc(), 'copy')).toEqual({
			keep: doc()
		});
		const gone = doc({ deleted: true, body: undefined, rev: 4 });
		expect(resolveConflict(mine, gone, 'copy')).toEqual({
			keep: gone,
			requeue: { kind: 'script', id: 'a', baseRev: 4, body: { name: 'one' } }
		});
	});
	it("uses the kind's merge, from the body both started with, instead of keeping both", () => {
		const merge = (base: unknown, a: unknown, b: unknown) => ({ base, a, b });
		const base = doc({ rev: 1, body: { name: 'start' } });
		expect(resolveConflict(mine, doc(), 'copy', { merge }, base)).toEqual({
			keep: doc(),
			requeue: {
				kind: 'script',
				id: 'a',
				baseRev: doc().rev,
				body: { base: { name: 'start' }, a: { name: 'one' }, b: doc().body }
			}
		});
		// A merge that comes out as the server's copy needs nothing sent.
		expect(resolveConflict(mine, doc(), 'copy', { merge: (_b, _a, theirs) => theirs })).toEqual({
			keep: doc()
		});
	});
});
