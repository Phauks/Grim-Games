/**
 * A player's side of the shared tray gestures (grimoire/tray-gestures.svelte.ts): where the
 * seats of their town are, and their tokens kept on this phone (PlayerReminderState). The
 * gestures themselves are the Storyteller bank's own (Trevor, 2026-11-10: "I just want them to
 * be the same"); the board's side is grimoire/board-tray-places.ts.
 */
import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import { trayFace, type TrayPlaces } from '#lib/features/grimoire/tray-gestures.svelte.ts';
import { copiesOf, placedKey, remindersOn, type PlayerReminder } from './player-reminders.ts';
import type { PlayerReminderState } from './player-reminders.svelte.ts';

/** A token on a seat, by the seat and the token: the hand's `reminderId` for a player's grim. */
export const placedId = (seatId: string, reminder: PlayerReminder): string =>
	`${seatId}\n${placedKey(reminder)}`;

/** The seat and the token a `placedId` names, if it is still there. */
export function placedAt(
	reminders: PlayerReminderState,
	id: string
): { seatId: string; reminder: PlayerReminder } | undefined {
	const cut = id.indexOf('\n');
	const seatId = id.slice(0, cut);
	const key = id.slice(cut + 1);
	const reminder = remindersOn(reminders.current, seatId).find((r) => placedKey(r) === key);
	return reminder && { seatId, reminder };
}

export interface PlayerTrayContext {
	reminders: PlayerReminderState;
	/** The town, which the seats and tokens lie in. */
	town: HTMLElement | undefined;
	seats: readonly { seatId: string }[];
	/** Each seat's centre, in % of the town. */
	points: readonly SeatPoint[];
	/** Token diameter in px. */
	size: number;
}

export function playerTrayPlaces(context: () => PlayerTrayContext): TrayPlaces {
	const reminders = () => context().reminders;
	return {
		area: () => context().town,
		/** As the board's: a drag's generous reach, a tap on the character token itself. */
		seatAt(at, tap) {
			const { town, points, seats, size } = context();
			if (!town) return undefined;
			const { width, height } = town.getBoundingClientRect();
			let best: string | undefined;
			let bestDistance = size * (tap ? 0.5 : 0.75);
			points.forEach((p, i) => {
				const d = Math.hypot(((p.x - at.x) / 100) * width, ((p.y - at.y) / 100) * height);
				if (d < bestDistance) {
					best = seats[i]?.seatId;
					bestDistance = d;
				}
			});
			return best;
		},
		placed: (id) => placedAt(reminders(), id)?.reminder,
		place(item, to, number, look) {
			if ('seatId' in to) reminders().place(to.seatId, trayFace(item, number, look));
		},
		move(id, _from, to) {
			const at = placedAt(reminders(), id);
			if (at && 'seatId' in to) reminders().move(at.seatId, at.reminder, to.seatId);
		},
		takeOff(id) {
			const at = placedAt(reminders(), id);
			if (at) reminders().move(at.seatId, at.reminder);
		},
		addToken: (look) => reminders().addToken(look),
		removeToken: (tokenId) => reminders().removeToken(tokenId),
		copiesOf(tokenId) {
			const token = reminders().tokens.find((t) => t.tokenId === tokenId);
			if (!token) return [];
			return copiesOf(reminders().current, token).map(({ seatId, reminder }) =>
				placedId(seatId, reminder)
			);
		},
		tokens: () => reminders().tokens
	};
}
