import type { GenericLook } from '#lib/core/model/index.ts';
import {
	addGenericReminder,
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
	#kept: string | undefined;

	/** This game's, or none while there is no game to keep them for. */
	load(kept: string | undefined): void {
		this.#kept = kept;
		this.current = kept ? readPlayerReminders(kept) : {};
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
			const { note, symbol, symbolColour, symbolFill } = reminder;
			const added = addGenericReminder(this.current, seatId, id);
			this.#save(setGenericLook(added, seatId, id, { note, symbol, symbolColour, symbolFill }));
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
