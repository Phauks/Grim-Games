import { describe, expect, it } from 'vitest';
import { emptyOutbox, markSent, MAX_SENT, parseOutbox, sendLater } from './outbox.ts';
import { ReportRefused } from './reports-api.ts';

const sendId = '2f1c0b7e-8d4a-4c55-9a8e-3b2d1f0e9c11';
const waiting = { sendId, draft: { kind: 'bug', title: 'x', body: 'y' }, savedAt: 1 } as const;

describe('parseOutbox', () => {
	it('starts empty from nothing, damage or another version', () => {
		expect(parseOutbox(null)).toEqual(emptyOutbox());
		expect(parseOutbox('x')).toEqual(emptyOutbox());
		expect(parseOutbox({ version: 2, waiting: [waiting] })).toEqual(emptyOutbox());
	});

	it('keeps good entries and drops damaged ones', () => {
		const stored = {
			version: 1,
			waiting: [waiting, { sendId, draft: { kind: 'spam' }, savedAt: 1 }],
			sent: [{ sendId, title: 'x', at: 2, id: 4 }, { title: 'no id' }]
		};
		expect(parseOutbox(stored)).toEqual({
			version: 1,
			waiting: [waiting],
			sent: [{ sendId, title: 'x', at: 2, id: 4 }]
		});
	});
});

describe('sendLater', () => {
	it('waits for a connection, a timeout, too many sends or a Worker error', () => {
		expect(sendLater(new TypeError('Failed to fetch'))).toBe(true);
		expect(sendLater(new ReportRefused(429, 'Slow down'))).toBe(true);
		expect(sendLater(new ReportRefused(503, 'Full'))).toBe(true);
		expect(sendLater(new ReportRefused(400, 'Bad title'))).toBe(false);
	});
});

describe('markSent', () => {
	it('moves a waiting report to the top of the sent list, which keeps the newest', () => {
		const old = Array.from({ length: MAX_SENT }, (_, i) => ({
			sendId: `old-report-${i}`,
			title: `${i}`,
			at: i
		}));
		const outbox = markSent({ version: 1, waiting: [waiting], sent: old }, sendId, 9, 5);
		expect(outbox.waiting).toEqual([]);
		expect(outbox.sent).toHaveLength(MAX_SENT);
		expect(outbox.sent[0]).toEqual({ sendId, title: 'x', at: 5, id: 9 });
	});
});
