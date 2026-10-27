import { describe, expect, it } from 'vitest';
import {
	isReportStatus,
	parseReportDraft,
	parseReportIdPath,
	parseReportScriptPath,
	REPORT_LIMITS,
	REPORT_STATUSES
} from './reports-protocol.ts';

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

describe('a report sent from a script (Trevor, 2026-10-22)', () => {
	const base = { kind: 'data', title: 'x', body: 'y' };
	const script = JSON.stringify([{ id: '_meta', name: 'Trouble Brewing' }, 'washerwoman']);

	it('keeps the script as TPI JSON with its name', () => {
		expect(parseReportDraft({ ...base, script, scriptName: 'Trouble Brewing' })).toEqual({
			...base,
			script,
			scriptName: 'Trouble Brewing'
		});
	});

	it('refuses a script that is not a JSON array or is too long', () => {
		expect(parseReportDraft({ ...base, script: '{"id":"_meta"}' })).toHaveProperty('error');
		expect(parseReportDraft({ ...base, script: 'not json' })).toHaveProperty('error');
		expect(
			parseReportDraft({ ...base, script: `["${'x'.repeat(REPORT_LIMITS.script)}"]` })
		).toHaveProperty('error');
	});

	it('drops a script name without a script', () => {
		expect(parseReportDraft({ ...base, scriptName: 'Trouble Brewing' })).toEqual(base);
	});

	it('reads the id from the script path', () => {
		expect(parseReportScriptPath('/api/reports/42/script')).toBe(42);
		expect(parseReportScriptPath('/api/reports/42')).toBeUndefined();
	});
});

describe('parseReportIdPath', () => {
	it('reads the id from the path', () => {
		expect(parseReportIdPath('/api/reports/42')).toBe(42);
		expect(parseReportIdPath('/api/reports/x')).toBeUndefined();
		expect(parseReportIdPath('/api/reports')).toBeUndefined();
	});
});

describe('a report saved to send while offline', () => {
	const base = { kind: 'bug', title: 'x', body: 'y' };

	it('keeps its send id, so a resend is stored once', () => {
		const sendId = '2f1c0b7e-8d4a-4c55-9a8e-3b2d1f0e9c11';
		expect(parseReportDraft({ ...base, sendId })).toEqual({ ...base, sendId });
	});

	it('refuses a send id that is not short letters, digits and dashes', () => {
		expect(parseReportDraft({ ...base, sendId: 'short' })).toHaveProperty('error');
		expect(parseReportDraft({ ...base, sendId: 'has spaces in it' })).toHaveProperty('error');
		expect(parseReportDraft({ ...base, sendId: 7 })).toHaveProperty('error');
	});
});

describe('report statuses', () => {
	it('has In progress between To do (accepted) and Done (Trevor, 2026-10-27)', () => {
		expect(isReportStatus('in-progress')).toBe(true);
		expect(REPORT_STATUSES.indexOf('in-progress')).toBe(REPORT_STATUSES.indexOf('accepted') + 1);
		expect(REPORT_STATUSES.indexOf('done')).toBe(REPORT_STATUSES.indexOf('in-progress') + 1);
	});
});
