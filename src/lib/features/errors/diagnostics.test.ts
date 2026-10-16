import { describe, expect, it } from 'vitest';
import { recordError } from './app-error.ts';
import {
	diagnosticsFileName,
	diagnosticsReportUrl,
	diagnosticsText,
	formatBytes,
	MAX_REPORT_URL,
	registeredRows,
	setDiagnostic,
	type Diagnostics
} from './diagnostics.ts';

const info = {
	version: '0.0.1',
	commit: '0123456789abcdef',
	branch: 'beta',
	builtAt: '2026-10-16T18:00:00.000Z',
	channel: 'preview'
} as const;

const label = (key: string) => key.replace('errors.diag.', '');

const sample: Diagnostics = {
	gatheredAt: Date.UTC(2026, 9, 16, 20),
	sections: [
		{
			id: 'build',
			title: 'errors.diag.build',
			rows: [{ label: 'errors.diag.version', value: '0.0.1' }]
		}
	],
	problems: [
		recordError(new Error('offline'), { area: 'scripts', page: '/scripts', handled: true, now: 1 })
	]
};

describe('diagnosticsText', () => {
	it('lists each section and every logged problem', () => {
		const text = diagnosticsText(sample, label);
		expect(text).toContain('## build\nversion: 0.0.1');
		expect(text).toContain('## problems (1)');
		expect(text).toContain('Error: offline');
	});
});

describe('diagnosticsReportUrl', () => {
	it('prefills the bug form with the whole text when it fits', () => {
		const url = new URL(diagnosticsReportUrl('short text', info, 'UA'));
		expect(url.searchParams.get('template')).toBe('bug_report.yml');
		expect(url.searchParams.get('page')).toBe('/diagnostics');
		expect(url.searchParams.get('error')).toBe('short text');
	});

	it('cuts long text to fit in a link and asks for the file instead', () => {
		const url = diagnosticsReportUrl('é'.repeat(20_000), info, 'UA');
		expect(url.length).toBeLessThanOrEqual(MAX_REPORT_URL);
		expect(new URL(url).searchParams.get('error')).toContain(
			'attach the downloaded diagnostics file'
		);
	});
});

describe('setDiagnostic', () => {
	it('adds rows from features, scrubbed, and removes them again', () => {
		const remove = setDiagnostic(
			'errors.diag.roomStatus',
			() => 'open wss://x.dev/api/room?k=SECRET'
		);
		expect(registeredRows()).toEqual([
			{ label: 'errors.diag.roomStatus', value: 'open x.dev/api/room' }
		]);
		remove();
		expect(registeredRows()).toEqual([]);
	});

	it('skips sources with nothing to say or that throw', () => {
		const a = setDiagnostic('errors.diag.roomStatus', () => undefined);
		expect(registeredRows()).toEqual([]);
		a();
		const b = setDiagnostic('errors.diag.roomStatus', () => {
			throw new Error('x');
		});
		expect(registeredRows()).toEqual([]);
		b();
	});
});

describe('formatting', () => {
	it('names the download by date and formats sizes', () => {
		expect(diagnosticsFileName(sample.gatheredAt)).toBe('grim-games-diagnostics-2026-10-16.txt');
		expect(formatBytes(2_500_000)).toBe('2.5 MB');
		expect(formatBytes(12_400)).toBe('12 KB');
		expect(formatBytes(null)).toBe('?');
	});
});
