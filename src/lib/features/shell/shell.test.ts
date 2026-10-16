import { describe, expect, it } from 'vitest';
import { leaveTo, setLeaveGuard, showsAppShell } from './shell.ts';

describe('showsAppShell', () => {
	it("hides the header and footer only where the route's data says it is a game", () => {
		expect(showsAppShell({ chrome: 'game' })).toBe(false);
		expect(showsAppShell({ chrome: 'app' })).toBe(true);
		expect(showsAppShell({})).toBe(true);
		expect(showsAppShell(null)).toBe(true);
	});
});

describe('leaving a game', () => {
	it('leaves at once without a guard, and through the guard while one is set', () => {
		const left: string[] = [];
		leaveTo(() => left.push('direct'));
		expect(left).toEqual(['direct']);

		let pending: (() => void) | undefined;
		const remove = setLeaveGuard((leave) => (pending = leave));
		leaveTo(() => left.push('guarded'));
		expect(left).toEqual(['direct']);
		pending?.();
		expect(left).toEqual(['direct', 'guarded']);

		remove();
		leaveTo(() => left.push('after'));
		expect(left).toEqual(['direct', 'guarded', 'after']);
	});
});
