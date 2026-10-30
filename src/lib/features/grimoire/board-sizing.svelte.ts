/**
 * Where everything sits on the grimoire board (GrimoireBoard): how big the tokens are, where
 * each seat goes round the ring, where each player's name goes, and where each seat's
 * reminders line up. The board measures itself and the things the reminders keep clear of
 * into this; the maths is in seat-layout.ts, board-geometry.ts and reminder-fan.ts.
 */
import { untrack } from 'svelte';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import { heldAbilitiesOf } from '#lib/core/rules/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import {
	clearOfCorner,
	keepInside,
	reminderTokenSize,
	seatPoints,
	seatTokenSize,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';
import { isOrphan } from './board.ts';
import {
	avoidBoxes,
	cornerFit,
	cornerObstacles,
	keepClear,
	nameBoxes,
	toPercent,
	toPx
} from './board-geometry.ts';
import type { Box } from './name-placement.ts';
import { boardLooks } from './board-looks.svelte.ts';
import { fitReminders } from './reminder-fan.ts';

/**
 * Each seat's slot is its token plus one --u (16px, unscaled by text size) either side;
 * keep it all on the board so a narrow phone never scrolls sideways.
 */
const UNIT = 16;

/** What the sizing reads from the board, fresh on each call. */
export interface BoardSizingContext {
	game: Game;
	characters: CharacterLookup;
	layout: SeatLayout;
	/** A watched board spaces its seats for the Storyteller's board shape. */
	spacedFor: number | undefined;
	/** The night's walk-through is open, so its strip takes part of the board's height. */
	walking: boolean;
	offScriptOk: ReadonlySet<CharacterId>;
	/** Track nominations is on, so every seat shows its nomination marks. */
	nominations: boolean;
	/**
	 * Each seat's place as shown, a dragged seat where it is (seat-arranging.svelte.ts). A
	 * function, as it is built from `points`: read only once the ring is known.
	 */
	shown: () => SeatPoint[];
	/** The seat being dragged, if any. */
	drag: { seatId: SeatId; at: SeatPoint } | undefined;
	rootFont: number;
}

export class BoardSizing {
	#context: () => BoardSizingContext;

	// The board's size, measured.
	width = $state(0);
	height = $state(0);
	/** The walk-through strip's share of the board's height. */
	stripReserve = $state(0);
	/** The day timer's row, top right: seats and reminders keep clear of it. */
	timerW = $state(0);
	timerH = $state(0);
	/** The Set up button and the Fabled and Loric in the middle. */
	centreW = $state(0);
	centreH = $state(0);
	/** The Fabled and Loric along the edge. */
	edgeW = $state(0);
	edgeH = $state(0);
	/** The script's name. */
	titleW = $state(0);
	titleH = $state(0);
	/** The tap target, the height every reminder takes on the board. */
	tapPx = $state(0);

	constructor(context: () => BoardSizingContext) {
		this.#context = context;
	}

	readonly board = $derived.by(() => ({ width: this.width, height: this.height }));

	/**
	 * Tokens are sized as if the walk-through strip weren't there, so starting the night only
	 * draws the seats closer together and never shrinks them (Trevor, 2026-10-23).
	 */
	readonly sizingHeight = $derived.by(() =>
		this.#context().walking ? this.height + this.stripReserve : this.height
	);

	/**
	 * The token size setting is applied here, within the spacing, so seats never overlap. It
	 * sizes the board only (Trevor, 2026-10-19): tokens elsewhere keep their own size.
	 */
	readonly size = $derived.by(() => {
		const { game, layout } = this.#context();
		return seatTokenSize(
			game.seating,
			layout,
			{ width: this.width, height: this.sizingHeight },
			preferences.current.tokenAppearance.tokenScale
		);
	});

	readonly chip = $derived(
		reminderTokenSize(this.size, preferences.current.tokenAppearance.reminderScale)
	);

	/**
	 * The ring comes down just far enough to keep every seat clear of the day timer and the
	 * buttons beside it (Trevor, 2026-10-27: Soundboard beside the timer), tappable on a phone.
	 */
	readonly points = $derived.by(() => {
		const { game, layout, spacedFor } = this.#context();
		const board = this.board;
		const onBoard = (l: SeatLayout) =>
			keepInside(seatPoints(game.seating, l, board, spacedFor), board, this.size / 2 + UNIT);
		return clearOfCorner(
			onBoard(layout),
			game.seating.map((id) => !layout.placed[id]),
			onBoard({ ...layout, placed: {} }),
			board,
			{ w: this.timerW + 12, h: this.timerH + 12 },
			this.size / 2
		);
	});

	/**
	 * A name goes beneath its token unless that is covered (name-placement.ts); each seat's
	 * reminders then line up in front of it, towards the middle, clear of the name.
	 */
	readonly nameBoxes = $derived.by(() => {
		const { game, rootFont } = this.#context();
		const shown = this.#context().shown();
		return nameBoxes({
			names: game.seating.map(
				(id, i) => game.seats[id].playerName ?? t('common.seat', { number: i + 1 })
			),
			seats: shown,
			size: this.size,
			unit: UNIT,
			rootFont,
			board: this.board
		});
	});

	/** How wide the corner may be for a given height (corner-room.ts); the name sits 4px in. */
	readonly fitCorner = $derived.by(() =>
		cornerFit(
			cornerObstacles(
				this.#context().shown(),
				this.nameBoxes,
				this.size,
				boardLooks.current.nameOffset,
				this.board
			),
			this.board
		)
	);

	/** What a seat's reminders keep off: its name, skull, note mark and top-rim marks. */
	#avoidFor(i: number): Box[] {
		const { game, characters, offScriptOk, nominations } = this.#context();
		const shown = this.#context().shown();
		const seat = game.seats[game.seating[i]];
		return avoidBoxes({
			centre: toPx(shown[i], this.board),
			size: this.size,
			hasFace: seat?.characterId !== undefined,
			name: this.nameBoxes[i]?.box,
			dead: !!seat?.dead,
			note: !!seat?.notes?.length,
			nameOffset: boardLooks.current.nameOffset,
			nominations,
			orphan: !!seat && isOrphan(seat, game.script, characters, offScriptOk),
			avatar: !!seat?.characterId && !!seat.avatar
		});
	}

	/**
	 * Every seat's reminders, laid out together so one seat's never cover another's (Trevor,
	 * 2026-10-16) and each stays nearest its own seat (2026-10-17), and every one is shown so
	 * each can be dragged. They are laid out at the height a finger needs (the tap target),
	 * which is what a reminder takes up on screen.
	 */
	readonly #restFan = $derived.by(() => {
		const { game, characters } = this.#context();
		const shown = this.#context().shown();
		const seats = game.seating.map((id) => game.seats[id]);
		// Vanilla: a held ability's token lines up after the seat's reminders (BoardSeats).
		const vanilla = boardLooks.current.abilityLook === 'vanilla';
		const counts = seats.map(
			(s) => s.reminders.length + (vanilla ? heldAbilitiesOf(game, s.seatId, characters).length : 0)
		);
		const { width, height } = this;
		if (width <= 0 || height <= 0)
			return seats.map((_, i) => Array.from({ length: counts[i] }, () => shown[i]));
		const board = this.board;
		const fitted = fitReminders(
			seats.map((_, i) => ({
				seat: toPx(shown[i], board),
				middle: { x: width / 2, y: height / 2 },
				count: counts[i],
				size: this.size,
				chip: Math.max(this.chip, this.tapPx),
				avoid: this.#avoidFor(i)
			})),
			// The Set up button and the Fabled and Loric in the middle, the Fabled and Loric along
			// the edge, the day timer and the script's name stay clear and tappable.
			keepClear({
				centre: { w: this.centreW, h: this.centreH },
				edge:
					boardLooks.current.rulesAt !== 'middle' ? { w: this.edgeW, h: this.edgeH } : undefined,
				timer: { w: this.timerW, h: this.timerH },
				title: { w: this.titleW, h: this.titleH },
				board
			}),
			board
		);
		return fitted.at.map((at) => at.map((p) => toPercent(p, board)));
	});

	#dragBase: { seatId: SeatId; at: SeatPoint; fan: SeatPoint[][] } | undefined;

	/**
	 * Each seat's reminders' places. While a seat is dragged, every reminder stays where it was
	 * when the seat was picked up and the seat's own go along with it, so none scatter mid-drag
	 * (Trevor, 2026-10-26); dropped, they fit around the seats again.
	 */
	readonly fan = $derived.by(() => {
		const { game, drag } = this.#context();
		if (!drag) {
			this.#dragBase = undefined;
			return this.#restFan;
		}
		if (this.#dragBase?.seatId !== drag.seatId)
			this.#dragBase = { seatId: drag.seatId, at: drag.at, fan: untrack(() => this.#restFan) };
		const { at, fan: base } = this.#dragBase;
		const i = game.seating.indexOf(drag.seatId);
		const dx = drag.at.x - at.x;
		const dy = drag.at.y - at.y;
		return base.map((spots, j) =>
			j === i ? spots.map((p) => ({ x: p.x + dx, y: p.y + dy })) : spots
		);
	});
}
