import { describe, expect, it } from 'vitest';
import {
	describeThrown,
	isBenignBrowserError,
	errorMessage,
	MAX_MESSAGE_LENGTH,
	MAX_STACK_LINES,
	parseErrorLog,
	recordError,
	scrubUrls
} from './app-error.ts';

const at = { area: 'scripts', page: '/scripts', handled: true, now: 1_000 };

describe('scrubUrls', () => {
	it('masks room, share and account codes kept in the path', () => {
		expect(scrubUrls('socket wss://x.dev/api/room/482913 closed at /join/482913')).toBe(
			'socket x.dev/api/room/•••• closed at /join/••••'
		);
		expect(scrubUrls('GET /api/share/abc123 and /api/account/docs/scripts/d-9 failed')).toBe(
			'GET /api/share/•••• and /api/account/docs/scripts/•••• failed'
		);
		expect(scrubUrls('/api/share POST /api/rooms ok')).toBe('/api/share POST /api/rooms ok');
	});

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

	it('stores the page with its room code masked', () => {
		expect(recordError(new Error('y'), { ...at, page: '/join/482913' }).page).toBe('/join/••••');
	});

	it('stores the page without its query string or hash', () => {
		expect(recordError(new Error('x'), { ...at, page: '/play#secret' }).page).toBe('/play');
	});
});

describe('parseErrorLog', () => {
	it('keeps well-formed records only, up to the limit', () => {
		const good = recordError(new Error('x'), at);
		expect(parseErrorLog([good, { key: 1 }, null, good], 1)).toEqual([good]);
		expect(parseErrorLog('nope', 5)).toEqual([]);
		const old = { ...good, page: '/join/482913', message: 'at wss://x.dev/api/room/482913' };
		expect(parseErrorLog([old], 1)[0]).toMatchObject({
			page: '/join/••••',
			message: 'at x.dev/api/room/••••'
		});
	});
});

describe('isBenignBrowserError', () => {
	it('ignores ResizeObserver loop warnings from Chrome and older browsers', () => {
		expect(
			isBenignBrowserError('ResizeObserver loop completed with undelivered notifications.')
		).toBe(true);
		expect(isBenignBrowserError('ResizeObserver loop limit exceeded')).toBe(true);
	});

	it('keeps real errors', () => {
		expect(isBenignBrowserError("Cannot read properties of undefined (reading 'x')")).toBe(false);
		expect(isBenignBrowserError(undefined)).toBe(false);
	});
});
