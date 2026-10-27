import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportOutbox } from './outbox.svelte.ts';
import type { ReportDraft } from './reports-protocol.ts';

const KEY = 'grim-games:report-outbox';
const draft: ReportDraft = { kind: 'bug', title: 'Bag forgets the Drunk', body: 'Twice.' };

/** A fresh outbox, as a newly opened app would make from what is stored. */
function openApp() {
	return new ReportOutbox();
}

function created(id: number) {
	return new Response(JSON.stringify({ id }), { status: 201 });
}

describe('reports saved while offline (Trevor, 2026-10-27)', () => {
	const sent: { sendId?: string }[] = [];
	let online = false;
	let nextId = 1;

	beforeEach(() => {
		localStorage.removeItem(KEY);
		sent.length = 0;
		online = false;
		nextId = 1;
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
			if (!online) throw new TypeError('Failed to fetch');
			sent.push(JSON.parse(String(init?.body)));
			return created(nextId++);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.removeItem(KEY);
	});

	it('keeps a report sent with no connection on the device, then sends it once', async () => {
		const outbox = openApp();
		const result = await outbox.send(draft);
		expect(result.status).toBe('waiting');
		expect(outbox.waiting.map((w) => w.draft.title)).toEqual([draft.title]);
		expect(localStorage.getItem(KEY)).toContain(draft.title);

		online = true;
		await outbox.flush();
		expect(outbox.waiting).toEqual([]);
		expect(outbox.sent).toMatchObject([{ title: draft.title, id: 1 }]);
		await outbox.flush();
		expect(sent).toHaveLength(1);
	});

	it('sends what was saved after the app is closed and opened again', async () => {
		const before = openApp();
		await before.send(draft);
		online = true;
		const after = openApp();
		expect(after.waiting).toHaveLength(1);
		await after.flush();
		expect(after.sent).toMatchObject([{ title: draft.title, id: 1 }]);
	});

	it('resends with the same send id, so the Worker stores it once', async () => {
		const outbox = openApp();
		await outbox.send(draft);
		const { sendId } = outbox.waiting[0];
		online = true;
		await outbox.flush();
		expect(sent.map((body) => body.sendId)).toEqual([sendId]);
	});

	it('says straight away when it went', async () => {
		online = true;
		const outbox = openApp();
		expect(await outbox.send(draft)).toEqual({ status: 'sent', id: 1 });
	});

	it('keeps waiting through Worker errors, but drops a report the Worker refuses', async () => {
		const outbox = openApp();
		vi.mocked(fetch).mockResolvedValueOnce(new Response('Slow down', { status: 429 }));
		expect((await outbox.send(draft)).status).toBe('waiting');
		vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad title', { status: 400 }));
		await outbox.flush();
		expect(outbox.waiting).toEqual([]);
		expect(outbox.sent).toMatchObject([{ title: draft.title }]);
		expect(outbox.sent[0].id).toBeUndefined();

		// Refused while the form is open: the form says so, the list doesn't keep it.
		vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad title', { status: 400 }));
		expect(await outbox.send({ ...draft, title: 'Second' })).toEqual({ status: 'refused' });
		expect(outbox.sent.map((s) => s.title)).toEqual([draft.title]);
	});
});
