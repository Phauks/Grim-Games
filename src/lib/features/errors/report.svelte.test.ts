import { afterEach, describe, expect, it, vi } from 'vitest';
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
