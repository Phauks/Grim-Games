/**
 * The locked pass-the-phone draw (Trevor, 2026-10-19; plan in
 * derivative-works-review/pass-the-phone-draw.md): a Storyteller PIN that keeps players from
 * leaving the draw for the grimoire. Kept on this device per game, never with the game, so
 * saved games need no migration. The PIN itself is never stored: only a salted SHA-256 hash.
 *
 * It is a deterrent, not security (clearing the site's data undoes it), and "Forgot PIN"
 * always unlocks after a visible countdown, so the Storyteller is never locked out.
 *
 * One PIN per game (Trevor, 2026-10-26): set the first time the draw is locked, it stays on
 * after unlocking, so locking again is one tap and every locked Storyteller screen of the
 * game takes the same PIN. Forgot PIN removes it, so the next lock sets a new one.
 *
 * Used by the Draw page, the board route (asks for the PIN while the game's draw is locked)
 * and the app shell (hides the sidebar and header while `lockedGame` is set). The grim cover
 * takes the same PIN when the Storyteller asks for one (Trevor, 2026-10-26), without locking
 * the draw: `setPin` and `checkPin`.
 */
import { toHex } from '#lib/core/codes/hash.ts';
import { waitAfter } from '#lib/core/rules/draw-lock.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const PREFIX = 'grim-games:draw-lock:';
/** Which game's draw is locked on this device, so the shell needn't scan storage. */
const LOCKED_GAME_KEY = 'grim-games:draw-locked-game';

/** The storage key of a game's lock. */
export function drawLockKey(gameId: string): string {
	return PREFIX + gameId;
}

interface StoredLock {
	v: 1;
	salt: string;
	hash: string;
	/** Wrong PINs in a row. */
	fails: number;
	/** No entry is checked before this time (ms since 1970). */
	waitUntil: number;
	/** False once unlocked with the PIN kept; locks saved before it existed are locked. */
	locked: boolean;
}

function readLock(gameId: string): StoredLock | undefined {
	const raw = readStored<Partial<StoredLock>>(drawLockKey(gameId));
	if (!raw || raw.v !== 1 || typeof raw.salt !== 'string' || typeof raw.hash !== 'string')
		return undefined;
	return {
		v: 1,
		salt: raw.salt,
		hash: raw.hash,
		fails: Number.isInteger(raw.fails) ? (raw.fails as number) : 0,
		waitUntil: typeof raw.waitUntil === 'number' ? raw.waitUntil : 0,
		locked: raw.locked !== false
	};
}

async function hashPin(salt: string, pin: string): Promise<string> {
	const data = new TextEncoder().encode(`${salt}:${pin}`);
	return toHex(await crypto.subtle.digest('SHA-256', data));
}

export type UnlockResult = 'ok' | 'wrong' | 'wait';

class DrawLock {
	/** Bumped on every change here or in another tab, so readers below re-run. */
	#version = $state(0);
	#listening = false;

	#listen() {
		if (this.#listening || typeof window === 'undefined') return;
		this.#listening = true;
		window.addEventListener('storage', (event) => {
			if (event.key === null || event.key === LOCKED_GAME_KEY || event.key.startsWith(PREFIX))
				this.#version++;
		});
	}

	/** The game whose draw is locked on this device, if any. */
	get lockedGame(): string | undefined {
		this.#listen();
		void this.#version;
		const id = readStored<string>(LOCKED_GAME_KEY);
		return typeof id === 'string' && readLock(id)?.locked ? id : undefined;
	}

	isLocked(gameId: string): boolean {
		this.#listen();
		void this.#version;
		return readLock(gameId)?.locked === true;
	}

	/** The game has its PIN, so locking needs no new one. */
	hasPin(gameId: string): boolean {
		this.#listen();
		void this.#version;
		return readLock(gameId) !== undefined;
	}

	/** When entry may be tried again for this game (0 when it may now). */
	waitUntil(gameId: string): number {
		void this.#version;
		return readLock(gameId)?.waitUntil ?? 0;
	}

	/** Locks with a new PIN, or without one with the game's own PIN. */
	async lock(gameId: string, pin?: string): Promise<void> {
		const kept = readLock(gameId);
		let lock: StoredLock;
		if (pin !== undefined) {
			const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
			const hash = await hashPin(salt, pin);
			lock = { v: 1, salt, hash, fails: 0, waitUntil: 0, locked: true };
		} else if (kept) lock = { ...kept, locked: true };
		else return;
		writeStored(drawLockKey(gameId), lock);
		writeStored(LOCKED_GAME_KEY, gameId);
		this.#version++;
	}

	/** Sets the game's PIN without locking the draw (the grim cover's first PIN). */
	async setPin(gameId: string, pin: string): Promise<void> {
		const kept = readLock(gameId);
		const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
		const hash = await hashPin(salt, pin);
		writeStored(drawLockKey(gameId), {
			v: 1,
			salt,
			hash,
			fails: 0,
			waitUntil: 0,
			locked: kept?.locked ?? false
		} satisfies StoredLock);
		this.#version++;
	}

	/**
	 * Checks the game's PIN without changing the draw's lock (the grim cover). A wrong one
	 * counts towards the same wait as the draw's; a game without a PIN passes.
	 */
	async checkPin(gameId: string, pin: string, now = Date.now()): Promise<UnlockResult> {
		const lock = readLock(gameId);
		if (!lock) return 'ok';
		if (now < lock.waitUntil) return 'wait';
		if ((await hashPin(lock.salt, pin)) === lock.hash) {
			if (lock.fails > 0) {
				writeStored(drawLockKey(gameId), { ...lock, fails: 0, waitUntil: 0 });
				this.#version++;
			}
			return 'ok';
		}
		const fails = lock.fails + 1;
		writeStored(drawLockKey(gameId), { ...lock, fails, waitUntil: now + waitAfter(fails) });
		this.#version++;
		return 'wrong';
	}

	/** Checks a PIN; a wrong one counts towards the wait (core/rules/draw-lock.ts). */
	async unlock(gameId: string, pin: string, now = Date.now()): Promise<UnlockResult> {
		const lock = readLock(gameId);
		if (!lock?.locked) return 'ok';
		if (now < lock.waitUntil) return 'wait';
		if ((await hashPin(lock.salt, pin)) === lock.hash) {
			// Unlocked, the PIN stays for the next lock.
			writeStored(drawLockKey(gameId), { ...lock, fails: 0, waitUntil: 0, locked: false });
			if (readStored(LOCKED_GAME_KEY) === gameId) writeStored(LOCKED_GAME_KEY, undefined);
			this.#version++;
			return 'ok';
		}
		const fails = lock.fails + 1;
		writeStored(drawLockKey(gameId), { ...lock, fails, waitUntil: now + waitAfter(fails) });
		this.#version++;
		return 'wrong';
	}

	/** Removes the lock and its PIN: "Forgot PIN" once its countdown has run. */
	clear(gameId: string): void {
		writeStored(drawLockKey(gameId), undefined);
		if (readStored(LOCKED_GAME_KEY) === gameId) writeStored(LOCKED_GAME_KEY, undefined);
		this.#version++;
	}
}

export const drawLock = new DrawLock();

/**
 * Keeps the screen on while `active` (best effort: not every browser has it, and it's
 * dropped when the page is hidden, so it's asked for again when the page shows).
 * Returns a cleanup for an `$effect`.
 */
export function keepScreenOn(): () => void {
	type Sentinel = { release(): Promise<void> };
	const wakeLock = (
		navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }
	).wakeLock;
	if (!wakeLock) return () => {};
	let sentinel: Sentinel | undefined;
	let stopped = false;
	const request = () => {
		if (stopped || document.visibilityState !== 'visible') return;
		wakeLock
			.request('screen')
			.then((s) => {
				if (stopped) void s.release();
				else sentinel = s;
			})
			.catch(() => {
				// Refused (battery saver, no permission): the screen may sleep as usual.
			});
	};
	request();
	document.addEventListener('visibilitychange', request);
	return () => {
		stopped = true;
		document.removeEventListener('visibilitychange', request);
		void sentinel?.release().catch(() => {});
	};
}
