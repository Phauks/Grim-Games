import { describe, expect, it } from 'vitest';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import {
	reportFileName,
	reportMarkdown,
	reportsFileName,
	reportsMarkdown
} from './report-export.ts';
import type { Report } from './reports-protocol.ts';

const label = (key: MessageKey) => key;
const report: Report = {
	id: 12,
	kind: 'bug',
	title: 'Bag forgets the Drunk',
	body: 'Draw the bag twice.\n```\nnot a fence\n```',
	status: 'new',
	createdAt: Date.UTC(2026, 9, 27, 3, 14),
	build: 'beta abc1234',
	device: 'Pixel',
	details: 'TypeError: x is undefined',
	hasScript: true,
	scriptName: 'Trouble Brewing'
};

describe('reports as Markdown (Trevor, 2026-10-27)', () => {
	it('lists what it was sent with, its text, details and script', () => {
		const text = reportMarkdown(
			{ report, reporter: 'Signed out', script: [{ id: '_meta' }, 'drunk'] },
			label
		);
		expect(text).toContain('## #12 Bag forgets the Drunk');
		expect(text).toContain('- reports.build: beta abc1234');
		expect(text).toContain('- reports.sentAt: 2026-10-27T03:14:00.000Z');
		expect(text).toContain('- reports.script: Trouble Brewing');
		expect(text).toContain('TypeError: x is undefined');
		expect(text).toContain('```json\n[{"id":"_meta"},"drunk"]\n```');
		// The fence around the description is longer than the backticks inside it.
		expect(text).toContain('````\nDraw the bag twice.');
		// Nothing for what it wasn't sent with.
		expect(text).not.toContain('reports.contact');
	});

	it('puts every shown report in one dated document', () => {
		const at = Date.UTC(2026, 9, 27);
		const text = reportsMarkdown(
			[
				{ report, reporter: 'a' },
				{ report: { ...report, id: 13 }, reporter: 'b' }
			],
			label,
			at
		);
		expect(text.startsWith('# reports.inbox (2), 2026-10-27T00:00:00.000Z')).toBe(true);
		expect(text.match(/\n---\n/g)).toHaveLength(2);
		expect(reportsFileName(at)).toBe('reports-2026-10-27.md');
		expect(reportFileName(12)).toBe('report-12.md');
	});
});
