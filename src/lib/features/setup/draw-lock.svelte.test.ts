import { afterEach, describe, expect, it } from 'vitest';
import { drawLock, drawLockKey } from './draw-lock.svelte.ts';

const GAME = 'pin-test-game';

describe('drawLock: one PIN per game (Trevor, 2026-10-26)', () => {
	afterEach(() => drawLock.clear(GAME));

	it('keeps the PIN after unlocking, so locking again needs none', async () => {
		expect(drawLock.hasPin(GAME)).toBe(false);
		await drawLock.lock(GAME, '2468');
		expect(drawLock.isLocked(GAME)).toBe(true);
		expect(drawLock.lockedGame).toBe(GAME);
		expect(await drawLock.unlock(GAME, '2468')).toBe('ok');
		expect(drawLock.isLocked(GAME)).toBe(false);
		expect(drawLock.lockedGame).toBeUndefined();
		expect(drawLock.hasPin(GAME)).toBe(true);
		await drawLock.lock(GAME);
		expect(drawLock.isLocked(GAME)).toBe(true);
		expect(await drawLock.unlock(GAME, '1111')).toBe('wrong');
		expect(await drawLock.unlock(GAME, '2468', Date.now() + 60_000)).toBe('ok');
	});

	it('locks without a PIN only when the game has one', async () => {
		await drawLock.lock(GAME);
		expect(drawLock.isLocked(GAME)).toBe(false);
	});

	it('Forgot PIN removes the PIN with the lock', async () => {
		await drawLock.lock(GAME, '2468');
		drawLock.clear(GAME);
		expect(drawLock.isLocked(GAME)).toBe(false);
		expect(drawLock.hasPin(GAME)).toBe(false);
	});

	it('a lock saved before the PIN was kept is still locked', () => {
		localStorage.setItem(
			drawLockKey(GAME),
			JSON.stringify({ v: 1, salt: 'aa', hash: 'bb', fails: 0, waitUntil: 0 })
		);
		expect(drawLock.isLocked(GAME)).toBe(true);
	});

	it('the grim cover sets and checks the PIN without locking the draw', async () => {
		await drawLock.setPin(GAME, '1357');
		expect(drawLock.hasPin(GAME)).toBe(true);
		expect(drawLock.isLocked(GAME)).toBe(false);
		expect(await drawLock.checkPin(GAME, '0000')).toBe('wrong');
		expect(await drawLock.checkPin(GAME, '1357')).toBe('ok');
		expect(drawLock.isLocked(GAME)).toBe(false);
		// The draw locks with the same PIN.
		await drawLock.lock(GAME);
		expect(drawLock.isLocked(GAME)).toBe(true);
		expect(await drawLock.checkPin(GAME, '1357')).toBe('ok');
		expect(drawLock.isLocked(GAME)).toBe(true);
	});

	it('wrong cover PINs make entry wait, as the draw does', async () => {
		await drawLock.setPin(GAME, '1357');
		const now = Date.now();
		for (let i = 0; i < 3; i++) expect(await drawLock.checkPin(GAME, '0000', now)).toBe('wrong');
		expect(await drawLock.checkPin(GAME, '1357', now)).toBe('wait');
	});
});
