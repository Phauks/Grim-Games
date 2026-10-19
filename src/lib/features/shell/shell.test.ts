import { describe, expect, it } from 'vitest';
import {
	leaveTo,
	lockedDrawHidesShell,
	mustAskBeforeLeaving,
	setLeaveGuard,
	showsAppShell
} from './shell.ts';

describe('showsAppShell', () => {
	it("hides the header and footer only where the route's data says it is a game", () => {
		expect(showsAppShell({ chrome: 'game' })).toBe(false);
		expect(showsAppShell({ chrome: 'app' })).toBe(true);
		expect(showsAppShell({})).toBe(true);
		expect(showsAppShell(null)).toBe(true);
	});
});

describe('lockedDrawHidesShell', () => {
	it("hides the shell on the locked game's screens only", () => {
		expect(lockedDrawHidesShell('/grimoire/g1/draw', 'g1')).toBe(true);
		expect(lockedDrawHidesShell('/grimoire/g1', 'g1')).toBe(true);
		expect(lockedDrawHidesShell('/grimoire/g10/draw', 'g1')).toBe(false);
		expect(lockedDrawHidesShell('/grimoire/g2/draw', 'g1')).toBe(false);
		expect(lockedDrawHidesShell('/', 'g1')).toBe(false);
		expect(lockedDrawHidesShell('/grimoire/g1/draw', undefined)).toBe(false);
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

	it('keeps the pass until the navigation asks, even after an await, and only once', async () => {
		const from = at('/draw');
		const remove = setLeaveGuard((leave) => leave());
		let navigation: Promise<boolean> | undefined;
		leaveTo(() => {
			// Like goto(): resolves the route first, then runs beforeNavigate.
			navigation = Promise.resolve()
				.then(() => new Promise((done) => setTimeout(done)))
				.then(() => mustAskBeforeLeaving(at('/'), 'goto', from));
		});
		expect(await navigation).toBe(false);
		expect(mustAskBeforeLeaving(at('/'), 'goto', from)).toBe(true);
		remove();
	});
});

describe('stacked leave guards', () => {
	it('asks the newest guard, and hands back to the one beneath when it is removed', () => {
		const asked: string[] = [];
		const removeConfirm = setLeaveGuard(() => asked.push('confirm'));
		const removePin = setLeaveGuard(() => asked.push('pin'));
		leaveTo(() => {});
		expect(asked).toEqual(['pin']);

		// Unlocking removes the PIN guard; the draw's Confirm still asks.
		removePin();
		leaveTo(() => {});
		expect(asked).toEqual(['pin', 'confirm']);

		removeConfirm();
		let left = false;
		leaveTo(() => (left = true));
		expect(left).toBe(true);
	});

	it('keeps the newer guard when an older one is removed first', () => {
		const asked: string[] = [];
		const removeOlder = setLeaveGuard(() => asked.push('older'));
		const removeNewer = setLeaveGuard(() => asked.push('newer'));
		removeOlder();
		leaveTo(() => {});
		expect(asked).toEqual(['newer']);
		removeNewer();
	});
});
