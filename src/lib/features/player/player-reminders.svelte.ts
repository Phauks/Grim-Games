import type { GenericLook } from '#lib/core/model/index.ts';
import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	addGenericReminder,
	countUp,
	phaseCount,
	readPlayerTokens,
	writePlayerTokens,
	type PlayerTokens,
	hasReminder,
	moveReminder,
	isGenericReminder,
	readPlayerReminders,
	setGenericLook,
	toggleReminder,
	writePlayerReminders,
	type PlayerReminder,
	type PlayerReminders
} from './player-reminders.ts';

/**
 * The reminder tokens a player put on the seats of their grim (Trevor, 2026-10-26), kept on
 * this phone per game (`gameKey`) as their guesses are; the Grim tab's one copy of them.
 */
export class PlayerReminderState {
	current = $state<PlayerReminders>({});
	/** The tray's own reusable ∞ tokens, made with "+ New token" (plan B9). */
	tokens = $state<PlayerTokens>([]);
	#kept: string | undefined;

	/** This game's, or none while there is no game to keep them for. */
	load(kept: string | undefined): void {
		this.#kept = kept;
		this.current = kept ? readPlayerReminders(kept) : {};
		this.tokens = kept ? readPlayerTokens(kept) : [];
	}

	#saveTokens(next: PlayerTokens): void {
		if (!this.#kept) return;
		this.tokens = next;
		writePlayerTokens(this.#kept, next);
	}

	/** A new ∞ token at the end of the tray's, with `look`; its id. */
	addToken(look: GenericLook = {}): string | undefined {
		if (!this.#kept) return undefined;
		const tokenId = crypto.randomUUID();
		this.#saveTokens([...this.tokens, { tokenId, ...look }]);
		return tokenId;
	}

	setTokenLook(tokenId: string, look: GenericLook): void {
		this.#saveTokens(this.tokens.map((t) => (t.tokenId === tokenId ? { ...t, ...look } : t)));
	}

	removeToken(tokenId: string): void {
		this.#saveTokens(this.tokens.filter((t) => t.tokenId !== tokenId));
	}

	/**
	 * The game's phase as the room sends it: each dusk or dawn passed since last seen counts up
	 * the # tokens set to (plan M53), once, even across a reload.
	 */
	atPhase(now: PlayersPhase | undefined): void {
		if (!this.#kept || !now) return;
		const at = phaseCount(now);
		const seenKey = `grim-games:play:counted:${this.#kept}`;
		const seen = readStored(seenKey) as { dusk?: unknown; dawn?: unknown } | undefined;
		const was = {
			dusk: typeof seen?.dusk === 'number' ? seen.dusk : at.dusk,
			dawn: typeof seen?.dawn === 'number' ? seen.dawn : at.dawn
		};
		writeStored(seenKey, at);
		const passed = { dusk: at.dusk - was.dusk, dawn: at.dawn - was.dawn };
		if (passed.dusk > 0 || passed.dawn > 0) this.#save(countUp(this.current, passed));
	}

	#save(next: PlayerReminders): void {
		if (!this.#kept) return;
		this.current = next;
		writePlayerReminders(this.#kept, next);
	}

	/** On the seat, or off it when it is there. */
	toggle(seatId: string, reminder: PlayerReminder): void {
		this.#save(toggleReminder(this.current, seatId, reminder));
	}

	/**
	 * From the tray (Trevor, 2026-10-29): a token onto a seat once, or a new generic one with
	 * the look it was given in hand.
	 */
	place(seatId: string, reminder: PlayerReminder): void {
		if (isGenericReminder(reminder)) {
			const id = crypto.randomUUID();
			const { note, symbol, symbolColour, symbolFill, like, countsUp } = reminder;
			const added = addGenericReminder(this.current, seatId, id);
			const look = { note, symbol, symbolColour, symbolFill, like, countsUp };
			this.#save(setGenericLook(added, seatId, id, look));
		} else if (!hasReminder(this.current, seatId, reminder)) this.toggle(seatId, reminder);
	}

	/**
	 * A token picked up off a seat (Trevor, 2026-10-31: as on the board): onto another seat,
	 * keeping its look, or back to the tray (`to` none).
	 */
	move(from: string, reminder: PlayerReminder, to?: string): void {
		this.#save(moveReminder(this.current, from, reminder, to));
	}

	setLook(seatId: string, id: string, look: GenericLook): void {
		this.#save(setGenericLook(this.current, seatId, id, look));
	}
}
