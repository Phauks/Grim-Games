import { describe, expect, it } from 'vitest';
import { parseReportDraft, parseReportIdPath, REPORT_LIMITS } from './reports-protocol.ts';

describe('parseReportDraft', () => {
	it('keeps a well-formed report, trimmed, and drops empty optional fields', () => {
		expect(
			parseReportDraft({
				kind: 'bug',
				title: '  Night order skips the Poisoner ',
				body: 'Steps',
				contact: '  ',
				build: 'v0.0.1'
			})
		).toEqual({
			kind: 'bug',
			title: 'Night order skips the Poisoner',
			body: 'Steps',
			build: 'v0.0.1'
		});
	});

	it('refuses unknown kinds, missing text and anything too long', () => {
		expect(parseReportDraft({ kind: 'spam', title: 'x', body: 'y' })).toHaveProperty('error');
		expect(parseReportDraft({ kind: 'bug', title: '', body: 'y' })).toHaveProperty('error');
		expect(
			parseReportDraft({ kind: 'bug', title: 'x', body: 'y'.repeat(REPORT_LIMITS.body + 1) })
		).toHaveProperty('error');
		expect(parseReportDraft({ kind: 'bug', title: 'x', body: 'y', details: 3 })).toHaveProperty(
			'error'
		);
		expect(parseReportDraft(null)).toHaveProperty('error');
	});
});

describe('parseReportIdPath', () => {
	it('reads the id from the path', () => {
		expect(parseReportIdPath('/api/reports/42')).toBe(42);
		expect(parseReportIdPath('/api/reports/x')).toBeUndefined();
		expect(parseReportIdPath('/api/reports')).toBeUndefined();
	});
});
