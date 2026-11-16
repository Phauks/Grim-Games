/**
 * Arranging seats: seats can be dragged anywhere (people on a couch, a gap by the door) and
 * gaps left between neighbours. Only where seats are drawn changes; the seating order does
 * not, unless a seat is dropped onto another. One behaviour for the Storyteller's board
 * (GrimoireBoard) and a players-only game's Grim tab (PlayerGrim, Trevor 2026-11-15: "In a
 * local only grim, should be able to arrange tokens as desired"); each only says how its
 * seats and layout are kept (`SeatTable`).
 */
import type { SeatId } from '#lib/core/model/index.ts';
import { hold } from '#lib/ui/hold.ts';
import {
	orderAround,
	seatPoints,
	spreadEvenly,
	swapPlaces,
	withPlaced,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { toPx, type BoardSize } from '#lib/features/board/board-geometry.ts';

/** How a board keeps its seats: the Storyteller's game, or a players-only town. */
export interface SeatTable {
	setLayout(layout: SeatLayout): void;
	/** Two players swap places; false when the swap didn't happen. */
	swap(a: SeatId, b: SeatId): boolean;
	/** A seat moves to `position` in the seating order. */
	move(seatId: SeatId, position: number): void;
}

/** What arranging reads from the board, fresh on each call. */
export interface ArrangeContext {
	table: SeatTable;
	seating: readonly SeatId[];
	layout: SeatLayout;
	/** Where each seat sits, in % of the board, in seating order. */
	points: SeatPoint[];
	/** Token size, in px. */
	size: number;
	board: BoardSize;
	/** The board element, for turning a pointer into a point on it. */
	element: HTMLElement | undefined;
	/**
	 * A point on the board as the layout keeps it, when the layout is of only part of the
	 * board (a player's ring above their reminder tray, tray-ring.ts). Left out, the same.
	 */
	toLayout?: (point: SeatPoint) => SeatPoint;
}

interface Drag {
	seatId: SeatId;
	pointerId: number;
	/** From the pointer to the seat's centre, so the seat does not jump under a finger. */
	offset: SeatPoint;
	at: SeatPoint;
	moved: boolean;
}

/** Pointer movement, in pixels, before a press counts as a drag. */
const DRAG_SLOP = 6;

export class SeatArranging {
	arranging = $state(false);
	drag = $state<Drag | undefined>();
	/**
	 * The seat last touched draws over the others where tokens overlap, its name included
	 * (Trevor, 2026-10-19). Only for this visit to the board: a reload goes back to seat order.
	 */
	front = $state<SeatId | undefined>();
	#pressedAt = { x: 0, y: 0 };
	/**
	 * A press outside Seating, which becomes a drag once it is a hold: holding a seat's
	 * token moves it (Trevor, 2026-10-25; the only thing a hold does, 2026-10-26).
	 */
	#pressed: (Drag & { target: HTMLElement }) | undefined;
	#context: () => ArrangeContext;

	constructor(context: () => ArrangeContext) {
		this.#context = context;
	}

	/** Where seats are drawn now: a dragged seat follows the finger, with its reminders. */
	shown = $derived.by(() => {
		const { points, seating } = this.#context();
		const drag = this.drag;
		return drag ? points.map((p, i) => (seating[i] === drag.seatId ? drag.at : p)) : points;
	});

	/** The other seat a dragged seat is over, if any: dropping there swaps the two players. */
	reorderTarget = $derived.by(() => {
		const drag = this.drag;
		if (!drag?.moved) return undefined;
		const { seating, points, size, board } = this.#context();
		let best: SeatId | undefined;
		let bestDistance = size * 0.6;
		seating.forEach((id, i) => {
			if (id === drag.seatId) return;
			const d = Math.hypot(
				((points[i].x - drag.at.x) / 100) * board.width,
				((points[i].y - drag.at.y) / 100) * board.height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	});

	start() {
		this.arranging = true;
		toast(
			'Seating',
			'Drag a seat anywhere to space the table, or onto another seat to swap the two players.'
		);
	}

	/**
	 * Distribute keeps hand moves (Trevor, 2026-10-16): the seating order is first read from
	 * where seats sit around the circle, so seats renumber to match (each move is in History),
	 * then they are spaced evenly in that order.
	 */
	spread() {
		const { table, seating, layout, board } = this.#context();
		const px = (p: SeatPoint) => toPx(p, board);
		const even = seatPoints(seating, spreadEvenly(layout), board);
		const target = orderAround(
			seating,
			this.shown.map(px),
			{ x: board.width / 2, y: board.height / 2 },
			even.map(px)
		);
		for (let i = 0; i < target.length; i++) {
			if (seating[i] !== target[i]) table.move(target[i], i);
		}
		table.setLayout(spreadEvenly(layout));
	}

	#boardPoint(event: PointerEvent, element: HTMLElement): SeatPoint {
		const rect = element.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		};
	}

	dragStart(event: PointerEvent, seatId: SeatId, at: SeatPoint) {
		this.front = seatId;
		const { element } = this.#context();
		this.#pressed = undefined;
		if (this.drag || !element) return;
		const p = this.#boardPoint(event, element);
		this.#pressedAt = { x: event.clientX, y: event.clientY };
		const drag = {
			seatId,
			pointerId: event.pointerId,
			offset: { x: at.x - p.x, y: at.y - p.y },
			at,
			moved: false
		};
		if (!this.arranging) {
			// Not yet: a tap still opens the seat.
			// The token itself takes the pointer once held, so its own release (ending the hold,
			// swallowing the click) still runs as the event bubbles up to this slot.
			const token = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
				'[data-testid="seat"]'
			);
			this.#pressed = { ...drag, target: token ?? (event.currentTarget as HTMLElement) };
			return;
		}
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		this.drag = drag;
	}

	/** The seat pressed is now held (SeatToken's onHold): dragging moves it. */
	held(seatId: SeatId) {
		const pressed = this.#pressed;
		this.#pressed = undefined;
		if (!pressed || pressed.seatId !== seatId || this.drag) return;
		const { target, ...drag } = pressed;
		try {
			target.setPointerCapture(drag.pointerId);
		} catch {
			// The pointer is already up: nothing to drag.
			return;
		}
		this.drag = drag;
	}

	dragMove(event: PointerEvent) {
		const drag = this.drag;
		const { element } = this.#context();
		if (!drag || event.pointerId !== drag.pointerId || !element) return;
		const moved =
			drag.moved ||
			Math.hypot(event.clientX - this.#pressedAt.x, event.clientY - this.#pressedAt.y) >= DRAG_SLOP;
		const p = this.#boardPoint(event, element);
		this.drag = { ...drag, moved, at: { x: p.x + drag.offset.x, y: p.y + drag.offset.y } };
	}

	dragEnd(event: PointerEvent) {
		this.#pressed = undefined;
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { table, layout, toLayout = (p: SeatPoint) => p } = this.#context();
		const target = this.reorderTarget;
		if (target) {
			// Onto another seat: the two players swap places (the Matron), one History entry.
			if (table.swap(drag.seatId, target)) table.setLayout(swapPlaces(layout, drag.seatId, target));
		} else if (drag.moved) table.setLayout(withPlaced(layout, drag.seatId, toLayout(drag.at)));
		this.drag = undefined;
	}

	dragCancel() {
		this.#pressed = undefined;
		this.drag = undefined;
	}

	/** Arrow keys move a seat while arranging, for keyboards and switch access. */
	nudge(event: KeyboardEvent, seatId: SeatId, at: SeatPoint) {
		if (!this.arranging) return;
		const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[
			event.key
		];
		if (!step) return;
		event.preventDefault();
		const { table, layout, toLayout = (p: SeatPoint) => p } = this.#context();
		table.setLayout(withPlaced(layout, seatId, toLayout({ x: at.x + step[0], y: at.y + step[1] })));
	}

	/** Each seat's attachment, kept so a redrawn seat keeps its press (and its hold). */
	#seats: Record<SeatId, { at: () => SeatPoint; attach: (node: HTMLElement) => () => void }> = {};

	/**
	 * A seat drawn by a plain element (a player's Grim tab): the same press, hold and drag as
	 * the board's seat slot with SeatToken's hold. `at` is where the seat is drawn now. The
	 * same attachment each time for a seat, so a change to the town mid-press never resets it.
	 */
	seat(seatId: SeatId, at: () => SeatPoint) {
		const kept = this.#seats[seatId];
		if (kept) {
			kept.at = at;
			return kept.attach;
		}
		const entry = {
			at,
			attach: (node: HTMLElement) => this.#attach(node, seatId, () => entry.at())
		};
		this.#seats[seatId] = entry;
		return entry.attach;
	}

	#attach(node: HTMLElement, seatId: SeatId, at: () => SeatPoint) {
		const stopHold = hold(() => this.held(seatId))(node);
		const down = (event: PointerEvent) => this.dragStart(event, seatId, at());
		const move = (event: PointerEvent) => this.dragMove(event);
		const up = (event: PointerEvent) => this.dragEnd(event);
		const cancel = () => this.dragCancel();
		const key = (event: KeyboardEvent) => this.nudge(event, seatId, at());
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', cancel);
		node.addEventListener('keydown', key);
		return () => {
			stopHold();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('keydown', key);
		};
	}
}
