import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleError } from '../../../hooks.client.ts';
import { errorLog, installGlobalErrorHandlers, MAX_LOGGED, reportError } from './report.svelte.ts';

describe('reportError', () => {
	afterEach(() => errorLog.clear());

	it('logs the problem, shows the card and persists the log on the device', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const entry = reportError(new Error('offline'), { area: 'scripts' });
		expect(errorLog.entries[0]).toEqual(entry);
		expect(errorLog.unseen).toEqual([entry?.key]);
		expect(localStorage.getItem('grim-games:error-log:v1')).toContain('offline');
	});

	it('only logs when the feature already shows the failure itself', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		reportError(new Error('quiet'), { area: 'reference', notify: false });
		expect(errorLog.entries).toHaveLength(1);
		expect(errorLog.unseen).toEqual([]);
	});

	it('merges repeats and keeps the newest distinct problems', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		reportError(new Error('same'), { area: 'a' });
		reportError(new Error('same'), { area: 'a' });
		expect(errorLog.entries).toHaveLength(1);
		expect(errorLog.entries[0].count).toBe(2);
		for (let i = 0; i < MAX_LOGGED + 5; i++) reportError(new Error(`e${i}`), { area: 'a' });
		expect(errorLog.entries).toHaveLength(MAX_LOGGED);
		expect(errorLog.entries[0].message).toBe(`e${MAX_LOGGED + 4}`);
	});

	it('opening the details clears the card but keeps the log', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		reportError(new Error('x'), { area: 'a' });
		errorLog.showDetails();
		expect(errorLog.unseen).toEqual([]);
		expect(errorLog.entries).toHaveLength(1);
		errorLog.open = false;
	});
});

describe('pages that could not open', () => {
	afterEach(() => errorLog.clear());

	// Trevor, 2026-10-26: "This page could not open" with nothing in Details to say why.
	const navigation = (path: string) =>
		({ url: new URL(path, location.origin) }) as Parameters<typeof handleError>[0]['event'];

	it('log the error against the page that failed, not the one navigated from', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		void handleError({
			kind: 'unknown',
			error: new Error('broken page'),
			status: 500,
			message: 'Internal Error',
			event: navigation('/new')
		} as Parameters<typeof handleError>[0]);
		expect(errorLog.entries[0]).toMatchObject({ message: 'broken page', page: '/new' });
	});

	it('log a missing build file quietly, so Details names it if the fresh load fails too', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		void handleError({
			kind: 'unknown',
			error: new TypeError('Failed to fetch dynamically imported module: /_app/x.js'),
			status: 500,
			message: 'Internal Error',
			event: navigation('/games')
		} as Parameters<typeof handleError>[0]);
		expect(errorLog.entries[0]).toMatchObject({ area: 'update', page: '/games' });
		expect(errorLog.unseen).toEqual([]);
	});
});

describe('global error handlers', () => {
	afterEach(() => errorLog.clear());

	it('ignore harmless ResizeObserver loop warnings but log real uncaught errors', () => {
		installGlobalErrorHandlers();
		for (const message of [
			'ResizeObserver loop completed with undelivered notifications.',
			'ResizeObserver loop limit exceeded'
		]) {
			window.dispatchEvent(new ErrorEvent('error', { message }));
		}
		expect(errorLog.entries).toEqual([]);
		window.dispatchEvent(new ErrorEvent('error', { message: 'x', error: new TypeError('real') }));
		expect(errorLog.entries.map((e) => e.message)).toEqual(['real']);
		expect(errorLog.unseen).toHaveLength(1);
	});
});
