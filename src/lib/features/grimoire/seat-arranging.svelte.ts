/**
 * Arranging seats (GrimoireBoard): seats can be dragged anywhere (people on a couch, a gap
 * by the door) and gaps left between neighbours. Only where seats are drawn changes; the
 * seating order does not, unless a seat is dropped onto another.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import {
	orderAround,
	seatPoints,
	spreadEvenly,
	withoutPlaced,
	withPlaced,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { toPx, type BoardSize } from './board-geometry.ts';
import type { Grimoire } from './grimoire.svelte.ts';

/** What arranging reads from the board, fresh on each call. */
export interface ArrangeContext {
	grimoire: Grimoire;
	seating: readonly SeatId[];
	layout: SeatLayout;
	/** Where each seat sits, in % of the board, in seating order. */
	points: SeatPoint[];
	/** Token size, in px. */
	size: number;
	board: BoardSize;
	/** The board element, for turning a pointer into a point on it. */
	element: HTMLElement | undefined;
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
	 * A press outside Arrange seats, which becomes a drag once it is a hold: holding a seat's
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

	/** The other seat a dragged seat is over, if any: dropping there changes the order. */
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
			'Arrange seats',
			'Drag a seat anywhere to space the table, or onto another seat to change the seating order.'
		);
	}

	/**
	 * Spread evenly keeps hand moves (Trevor, 2026-10-16): the seating order is first read from
	 * where seats sit around the circle, so seats renumber to match (each move is in History),
	 * then they are spaced evenly in that order.
	 */
	spread() {
		const { grimoire, seating, layout, board } = this.#context();
		const px = (p: SeatPoint) => toPx(p, board);
		const even = seatPoints(seating, spreadEvenly(layout), board);
		const target = orderAround(
			seating,
			this.shown.map(px),
			{ x: board.width / 2, y: board.height / 2 },
			even.map(px)
		);
		for (let i = 0; i < target.length; i++) {
			if (seating[i] !== target[i])
				grimoire.run({ type: 'MoveSeat', seatId: target[i], position: i });
		}
		grimoire.setLayout(spreadEvenly(grimoire.layout));
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
		const { grimoire, seating, layout } = this.#context();
		const target = this.reorderTarget;
		if (target) {
			// Onto another seat: the player takes that place in the seating order (one History
			// entry), and follows the ring rather than a hand-placed spot.
			const position = seating.indexOf(target);
			if (grimoire.run({ type: 'MoveSeat', seatId: drag.seatId, position }))
				grimoire.setLayout(withoutPlaced(layout, drag.seatId));
		} else if (drag.moved) grimoire.setLayout(withPlaced(layout, drag.seatId, drag.at));
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
		const { grimoire, layout } = this.#context();
		grimoire.setLayout(withPlaced(layout, seatId, { x: at.x + step[0], y: at.y + step[1] }));
	}
}
