import { describe, expect, it } from 'vitest';
import { ALL_INBOX, filterInbox, inboxSenders } from './inbox-filter.ts';
import type { InboxItem } from './inbox.svelte.ts';

// Trevor, 2026-10-28: "filters to message menu to sort by player and if requesting
// consultation and unread or read".

const items: InboxItem[] = [
	{ kind: 'message', id: 'm1', memberId: 'alex', text: 'Hi', at: 3, consult: true },
	{ kind: 'message', id: 'm2', memberId: 'sam', text: 'Yo', at: 2, read: true },
	{ kind: 'picture', id: 'h1', hash: 'h1', memberId: 'sam', count: 1, at: 1 }
];
const ids = (f: Partial<typeof ALL_INBOX>) =>
	filterInbox(items, { ...ALL_INBOX, ...f }).map((i) => i.id);

describe('Messages filters', () => {
	it('show everything by default', () => {
		expect(ids({})).toEqual(['m1', 'm2', 'h1']);
	});

	it('show one player’s messages and pictures', () => {
		expect(ids({ player: 'sam' })).toEqual(['m2', 'h1']);
	});

	it('split unread from read, a picture waiting for a verdict counting as unread', () => {
		expect(ids({ read: false })).toEqual(['m1', 'h1']);
		expect(ids({ unread: false })).toEqual(['m2']);
		expect(ids({ unread: false, read: false })).toEqual([]);
	});

	it('keep only requests for a consult', () => {
		expect(ids({ consult: true })).toEqual(['m1']);
		expect(ids({ consult: true, player: 'sam' })).toEqual([]);
	});

	it('list each sender once', () => {
		expect(inboxSenders(items)).toEqual(['alex', 'sam']);
	});
});
