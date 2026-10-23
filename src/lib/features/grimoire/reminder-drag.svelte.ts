/**
 * Dragging a reminder on the board (GrimoireBoard): from a seat, a Fabled or Loric, or loose
 * on the board, onto another seat, a Fabled or Loric, the setup tray, or (loose mode) any
 * free spot. A move goes through ReminderMoveConfirm, so it is one History entry.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import {
	looseReminders,
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
import { onBoard } from './reminders.ts';

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
	/** Loose mode (Trevor, 2026-10-18): nothing is given to a seat. */
	free: boolean;
	confirm: ReturnType<typeof ReminderMoveConfirm> | undefined;
}

export interface ReminderDrag {
	reminderId: ReminderId;
	/** The seat it is on; none for a loose reminder or one a Fabled or Loric holds. */
	from: SeatId | undefined;
	/** Where the token is, in % of the board. */
	at: SeatPoint;
	target?: SeatId;
}

/**
 * A reminder being dragged, from the bank or the board: whose it is, its words and where the
 * token is, so the board or the bank can say where it came from (boardLooks.dragSource).
 */
export interface DraggedReminder {
	characterId: CharacterId;
	label: ReminderLabel;
	/** The seat it was placed for, if any, which can change its alignment. */
	ownerSeatId?: SeatId;
	at: SeatPoint;
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
		const reminder = onBoard(game).find((r) => r.reminderId === id);
		if (!reminder) return undefined;
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

	/** The seat under a point (in % of the board), if it is within reach of a token. */
	seatAt = (at: SeatPoint): SeatId | undefined => {
		const { game, points, size, board } = this.#context();
		let best: SeatId | undefined;
		let bestDistance = size * 0.75;
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
	 * Where a free reminder may stay: on the board, but not over the reminder bank, the night
	 * walk-through, the middle's buttons, the timer or the Fabled and Loric (Trevor, 2026-10-17).
	 */
	spotAllowed = (x: number, y: number): boolean => {
		const { element } = this.#context();
		if (!element) return false;
		const inside = (r: DOMRect | undefined) =>
			!!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
		if (!inside(element.getBoundingClientRect())) return false;
		const blocked = element.querySelectorAll(
			'[data-tray], [data-testid="night-strip"], .centre > *, .board-timer, .rules-edge'
		);
		return ![...blocked].some((el) => inside(el.getBoundingClientRect()));
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
	move(reminderId: ReminderId, from: SeatId | undefined, x: number, y: number, end: boolean) {
		const { element, grimoire, game, free, confirm } = this.#context();
		if (!element) return;
		const rect = element.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = this.seatAt(at);
		if (!end) {
			this.drag = { reminderId, from, at, target: free ? undefined : target };
			return;
		}
		this.drag = undefined;
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
		// Loose mode (Trevor, 2026-10-18): nothing is given to a seat. A reminder goes where it
		// is dropped, seats included; one still on a seat from before comes off it.
		if (free) {
			if (!this.spotAllowed(x, y)) return;
			if (looseReminders(game).some((r) => r.reminderId === reminderId))
				grimoire.setReminderSpot(reminderId, at);
			else confirm?.requestLoose(reminderId, () => grimoire.setReminderSpot(reminderId, at));
			return;
		}
		// Dropped on another seat: moved (one History entry).
		if (target && target !== from) confirm?.request(reminderId, target);
	}
}
