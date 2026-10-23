import { describe, expect, it } from 'vitest';
import {
	parseReportDraft,
	parseReportIdPath,
	parseReportScriptPath,
	REPORT_LIMITS
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
