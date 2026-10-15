import { describe, expect, it } from 'vitest';
import {
	describeThrown,
	errorDetails,
	errorMessage,
	errorReportUrl,
	MAX_MESSAGE_LENGTH,
	MAX_STACK_LINES,
	parseErrorLog,
	recordError,
	scrubUrls
} from './app-error.ts';

const info = {
	version: '0.0.1',
	commit: '0123456789abcdef',
	branch: 'beta',
	builtAt: '2026-10-15T18:00:00.000Z',
	channel: 'preview'
} as const;

const at = { area: 'scripts', page: '/scripts', handled: true, now: 1_000 };

describe('scrubUrls', () => {
	it('drops query strings and hashes, which can carry scripts or room secrets', () => {
		expect(scrubUrls('GET https://example.com/a/b?room=SECRET#script=xyz failed')).toBe(
			'GET example.com/a/b failed'
		);
	});

	it('keeps text without URLs as it is', () => {
		expect(scrubUrls('x is undefined')).toBe('x is undefined');
	});
});

describe('describeThrown', () => {
	it('reads Errors, keeping a short stack without the repeated first line', () => {
		const error = new TypeError('boom');
		error.stack = [
			'TypeError: boom',
			...Array.from({ length: 20 }, (_, i) => `    at f${i} (https://x.dev/app.js?v=1:1:${i})`)
		].join('\n');
		const { name, message, stack } = describeThrown(error);
		expect(name).toBe('TypeError');
		expect(message).toBe('boom');
		expect(stack?.split('\n')).toHaveLength(MAX_STACK_LINES);
		expect(stack).toContain('at f0 (x.dev/app.js');
		expect(stack).not.toContain('?v=1');
	});

	it('clips long messages', () => {
		expect(errorMessage(new Error('x'.repeat(1000)))).toHaveLength(MAX_MESSAGE_LENGTH);
	});

	it('never copies the contents of non-error values, which may hold game state', () => {
		expect(describeThrown({ players: ['Sam'] }).message).toBe(
			'a non-error value was thrown (object)'
		);
		expect(describeThrown('plain text').message).toBe('plain text');
	});
});

describe('recordError', () => {
	it('counts repeats of the same problem in the same area', () => {
		const first = recordError(new Error('offline'), at);
		const again = recordError(new Error('offline'), { ...at, now: 2_000 }, first);
		expect(again).toMatchObject({ count: 2, firstAt: 1_000, lastAt: 2_000 });
	});

	it('starts a new record for a different problem', () => {
		const first = recordError(new Error('offline'), at);
		expect(recordError(new Error('other'), at, first).count).toBe(1);
	});

	it('stores the page without its query string or hash', () => {
		expect(recordError(new Error('x'), { ...at, page: '/play#secret' }).page).toBe('/play');
	});
});

describe('errorReportUrl', () => {
	it('prefills the bug report form, including the error details field', () => {
		const error = recordError(new RangeError('bad seat'), at);
		const url = new URL(errorReportUrl(error, info, 'Phone UA'));
		expect(url.origin + url.pathname).toBe('https://github.com/Phauks/Grim-Games/issues/new');
		const params = url.searchParams;
		expect(params.get('template')).toBe('bug_report.yml');
		expect(params.get('title')).toBe('[Bug] RangeError in scripts: bad seat');
		expect(params.get('page')).toBe('/scripts');
		expect(params.get('device')).toBe('Phone UA');
		expect(params.get('build')).toContain('0123456');
		expect(params.get('error')).toBe(errorDetails(error));
	});
});

describe('parseErrorLog', () => {
	it('keeps well-formed records only, up to the limit', () => {
		const good = recordError(new Error('x'), at);
		expect(parseErrorLog([good, { key: 1 }, null, good], 1)).toEqual([good]);
		expect(parseErrorLog('nope', 5)).toEqual([]);
	});
});
