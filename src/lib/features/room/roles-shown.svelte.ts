import { readStored, writeStored } from '#lib/ui/stored.ts';
import { STORAGE_KEY, type StoredRoom } from './host-storage.ts';

/** How long players may see their character once shown (Trevor, 2026-10-28: "1 minute"). */
export const ROLES_SHOWN_MS = 60_000;

/**
 * The game whose players may see their own character on their phone (Trevor, 2026-10-26:
 * "can turn on and off when ppl can see it"). Off until turned on, and per game. It turns
 * itself off ROLES_SHOWN_MS later (Trevor, 2026-10-28: "See character should only be
 * available for 1 minute, then turn off"), and a reload keeps the same minute.
 */
export class RolesShown {
	gameId = $state<string>();
	/** When it turns itself off (epoch ms), for the Storyteller's countdown. */
	until = $state<number>();
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** Picks up a minute still running in the stored room. */
	restore(stored: StoredRoom): void {
		const left = (stored.rolesShownUntil ?? 0) - Date.now();
		if (stored.rolesShown && left > 0) this.#show(stored.rolesShown, left);
	}

	/** Lets game `gameId`'s players see their characters for a minute, or hides them. */
	set(gameId: string | undefined): void {
		const until = Date.now() + ROLES_SHOWN_MS;
		if (gameId) this.#show(gameId, ROLES_SHOWN_MS);
		else this.stop();
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored) return;
		const { rolesShown: _old, rolesShownUntil: _until, ...rest } = stored;
		void [_old, _until];
		writeStored(
			STORAGE_KEY,
			gameId ? { ...rest, rolesShown: gameId, rolesShownUntil: until } : rest
		);
	}

	/** Hides them, without touching what the device stores (the room is being forgotten). */
	stop(): void {
		clearTimeout(this.#timer);
		this.gameId = undefined;
		this.until = undefined;
	}

	#show(gameId: string, ms: number): void {
		clearTimeout(this.#timer);
		this.gameId = gameId;
		this.until = Date.now() + ms;
		this.#timer = setTimeout(() => {
			if (this.gameId === gameId) this.set(undefined);
		}, ms);
	}
}
