import type { GenericLook } from '#lib/core/model/index.ts';
import {
	addGenericReminder,
	hasReminder,
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

	/** From the bin (Trevor, 2026-10-29): a token onto a seat once, or a new generic one. */
	place(seatId: string, reminder: PlayerReminder): void {
		if (isGenericReminder(reminder))
			this.#save(addGenericReminder(this.current, seatId, crypto.randomUUID()));
		else if (!hasReminder(this.current, seatId, reminder)) this.toggle(seatId, reminder);
	}

	setLook(seatId: string, id: string, look: GenericLook): void {
		this.#save(setGenericLook(this.current, seatId, id, look));
	}
}
