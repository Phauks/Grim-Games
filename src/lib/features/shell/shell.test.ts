import { describe, expect, it } from 'vitest';
import { leaveTo, mustAskBeforeLeaving, setLeaveGuard, showsAppShell } from './shell.ts';

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

describe('which navigations ask before leaving', () => {
	const at = (path: string) => new URL(path, 'https://grim.test');

	it('asks only while a guard is set, for paths outside the screen', () => {
		const from = at('/grimoire/g1');
		expect(mustAskBeforeLeaving(at('/scripts'), 'link', from)).toBe(false);

		const remove = setLeaveGuard(
			() => {},
			(url) => url.pathname.startsWith('/grimoire/g1')
		);
		expect(mustAskBeforeLeaving(at('/scripts'), 'link', from)).toBe(true);
		expect(mustAskBeforeLeaving(at('/scripts'), 'popstate', from)).toBe(true);
		// Inside the game, the same page, or closing the tab: no question.
		expect(mustAskBeforeLeaving(at('/grimoire/g1/day'), 'link', from)).toBe(false);
		expect(mustAskBeforeLeaving(at('/grimoire/g1#x'), 'link', from)).toBe(false);
		expect(mustAskBeforeLeaving(at('/scripts'), 'leave', from)).toBe(false);
		remove();
		expect(mustAskBeforeLeaving(at('/scripts'), 'link', from)).toBe(false);
	});

	it('lets the confirmed navigation through', () => {
		const from = at('/draw');
		let asked: boolean | undefined;
		const remove = setLeaveGuard((leave) => leave());
		leaveTo(() => (asked = mustAskBeforeLeaving(at('/'), 'goto', from)));
		expect(asked).toBe(false);
		remove();
	});
});
