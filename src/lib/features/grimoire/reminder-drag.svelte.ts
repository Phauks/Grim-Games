/**
 * Dragging a reminder on the board (GrimoireBoard): from a seat, a Fabled or Loric, or loose
 * on the board, onto another seat, a Fabled or Loric, the setup tray, the bank's "+ New token"
 * (a new ∞ token like it). A move goes through ReminderMoveConfirm, so it is one History entry.
 * Reminders are always held by a seat (Trevor, 2026-10-31: no "Stay where dropped"); a loose
 * one from an older build goes on a seat the same way.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import {
	ruleReminders,
	trueCharacter,
	type CharacterLookup,
	type Game,
	type Reminder,
	type ReminderId,
	type SeatId
} from '#lib/core/model/index.ts';
import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import type { BoardSize } from './board-geometry.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import type ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
import { copiedLook, handReminder, onBoard } from './reminders.ts';

/**
 * Whether a client point is over the bank's "+ New token" (Trevor, 2026-10-27): a reminder
 * dropped there becomes a new ∞ token with its text and symbol, and stays where it was.
 */
export const overNewToken = (x: number, y: number): boolean =>
	document.elementsFromPoint(x, y).some((el) => el.closest('[data-new-token]') !== null);

/** What dragging reads from the board, fresh on each call. */
export interface ReminderDragContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	/** Where each seat sits, in % of the board, in seating order. */
	points: SeatPoint[];
	/** Token size, in px. */
	size: number;
	board: BoardSize;
	/** The board element. */
	element: HTMLElement | undefined;
	confirm: ReturnType<typeof ReminderMoveConfirm> | undefined;
}

export interface ReminderDrag {
	reminderId: ReminderId;
	/** The seat it is on; none for a loose reminder or one a Fabled or Loric holds. */
	from: SeatId | undefined;
	/** Where the token is, in % of the board. */
	at: SeatPoint;
	target?: SeatId;
	/** Over the bank's "+ New token", which glows (Trevor, 2026-10-27). */
	overNew?: boolean;
}

export class ReminderDragging {
	drag = $state<ReminderDrag | undefined>();
	#context: () => ReminderDragContext;

	constructor(context: () => ReminderDragContext) {
		this.#context = context;
	}

	/**
	 * Where a dragged reminder came from (Trevor, 2026-10-16): its character, the seats that
	 * hold that character (marked on the board) and the seat it is on now.
	 */
	origin = $derived.by(() => {
		if (!this.drag) return undefined;
		const id = this.drag.reminderId;
		const { game, characters } = this.#context();
		const placed = onBoard(game).find((r) => r.reminderId === id);
		if (!placed) return undefined;
		// A generic copy of a character's reminder marks as that reminder (Trevor, 2026-10-27).
		const reminder = handReminder(placed);
		const holders = game.seating.filter(
			(s) =>
				game.seats[s].characterId === reminder.characterId ||
				trueCharacter(game, s, characters) === reminder.characterId
		);
		return { holders, reminder };
	});

	/** A Fabled or Loric's reminder being dragged off it. */
	held = $derived.by(() => {
		const id = this.drag?.reminderId;
		if (!id) return undefined;
		return Object.values(this.#context().game.ruleReminders ?? {})
			.flat()
			.find((r) => r.reminderId === id);
	});

	/**
	 * The seat under a point (in % of the board), if it is within reach of a token: a drag's
	 * generous reach, or `onToken` for a tap, which must land on the character token itself
	 * (Trevor, 2026-10-31).
	 */
	seatAt = (at: SeatPoint, onToken = false): SeatId | undefined => {
		const { game, points, size, board } = this.#context();
		let best: SeatId | undefined;
		let bestDistance = size * (onToken ? 0.5 : 0.75);
		game.seating.forEach((id, i) => {
			const d = Math.hypot(
				((points[i].x - at.x) / 100) * board.width,
				((points[i].y - at.y) / 100) * board.height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	};

	/**
	 * The Fabled or Loric under a client point, if any: its own token, or the grouped stack
	 * (then the one whose reminder it is, else the first) (Trevor, 2026-10-17).
	 */
	ruleAt = (x: number, y: number, reminder: Reminder): CharacterId | undefined => {
		const hit = document
			.elementsFromPoint(x, y)
			.map((el) => el.closest<HTMLElement>('[data-rule], [data-rule-stack]'))
			.find((el) => el !== null);
		if (!hit) return undefined;
		if (hit.dataset.rule) return hit.dataset.rule;
		const { game } = this.#context();
		return game.ruleCharacters.includes(reminder.characterId)
			? reminder.characterId
			: game.ruleCharacters[0];
	};

	cancel() {
		this.drag = undefined;
	}

	/** A reminder's drag, from `from` (if on a seat), to a client point; `end` when let go. */
	move(
		reminderId: ReminderId,
		from: SeatId | undefined,
		x: number,
		y: number,
		end: boolean,
		tap = false
	) {
		const { element, grimoire, game, confirm } = this.#context();
		if (!element) return;
		const rect = element.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = this.seatAt(at, tap);
		if (!end) {
			const overNew = overNewToken(x, y);
			this.drag = {
				reminderId,
				from,
				at,
				target: overNew ? undefined : target,
				overNew: overNew || undefined
			};
			return;
		}
		this.drag = undefined;
		// Dropped on "+ New token" (it sits in the tray): a new ∞ token like it.
		if (overNewToken(x, y)) {
			const reminder = onBoard(game).find((r) => r.reminderId === reminderId);
			if (reminder) grimoire.run({ type: 'AddGenericToken', look: copiedLook(reminder) });
			return;
		}
		// Dropped back on the setup reminders tray: it waits there again (History has it).
		const tray = element.querySelector('[data-tray]')?.getBoundingClientRect();
		if (tray && x >= tray.left && x <= tray.right && y >= tray.top && y <= tray.bottom) {
			confirm?.requestReturn(reminderId);
			return;
		}
		const reminder = onBoard(game).find((r) => r.reminderId === reminderId);
		if (!reminder) return;
		// Dropped on a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17).
		const rule = this.ruleAt(x, y, reminder);
		if (rule) {
			if (!ruleReminders(game, rule).some((r) => r.reminderId === reminderId))
				confirm?.requestRule(reminderId, rule);
			return;
		}
		// Dropped on another seat: moved (one History entry).
		if (target && target !== from) confirm?.request(reminderId, target);
	}
}
