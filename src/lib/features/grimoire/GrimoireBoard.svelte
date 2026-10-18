<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import type { Night, NightStep } from '#lib/core/rules/index.ts';
	import GuidedStep from './GuidedStep.svelte';
	import NightStrip from './NightStrip.svelte';
	import HistoryStrip from './HistoryStrip.svelte';
	import { gameModeName } from './game-mode-name.ts';
	import { boardNightSteps, stepHolders, tonight } from './night-steps.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import AlignmentDraw from './AlignmentDraw.svelte';
	import { endedGames } from './device-notes.ts';
	import { prepareRoom, roomHost } from '#lib/features/room/host.svelte.ts';
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { backgroundFor, PRESETS, type BackgroundChoice } from './backgrounds.ts';
	import { boardBackground } from './board-background.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import NavMenuButton from '#lib/features/shell/NavMenuButton.svelte';
	import { goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { currentSetupStep, REMINDERS_HASH } from '#lib/features/setup/setup-steps.ts';
	import { resolve } from '$app/paths';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		charactersInPlay,
		looseReminders,
		ruleReminders,
		scriptCharacterIds,
		trueCharacter,
		type Reminder,
		type ReminderInstance,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import InfoTokensSheet from '#lib/features/info-tokens/InfoTokensSheet.svelte';
	import {
		livingByTeam,
		setupComplete,
		diedSinceNewDay,
		ON_DEATH,
		setupReminders,
		stepNightNumbers
	} from '#lib/core/rules/index.ts';
	import DayTimer from '#lib/features/day/DayTimer.svelte';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import { showableBluffSets } from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import ReminderOrigin from './ReminderOrigin.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		followSeating,
		isDefaultLayout,
		isRotation,
		keepInside,
		seatPoints,
		seatTokenSize,
		spreadEvenly,
		orderAround,
		withPlaced,
		withoutPlaced,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { rememberBoard } from '#lib/ui/seating/last-board.svelte.ts';
	import { nameBox, placeNames, type Box } from './name-placement.ts';
	import { cornerRoom } from './corner-room.ts';
	import { fitReminders } from './reminder-fan.ts';
	import { isOrphan, placingAlignment, seatMisses } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import PlayerScriptTabs from '#lib/features/player/PlayerScriptTabs.svelte';
	import HistoryDialog from './HistoryDialog.svelte';
	import NightOrderSheet from './NightOrderSheet.svelte';
	import DaySheet from '#lib/features/day/DaySheet.svelte';
	import { DAY_HASH } from '#lib/features/day/day-hash.ts';
	import SeatSheet from './SeatSheet.svelte';
	import SeatToken from './SeatToken.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import { stepReminders } from './reminders.ts';
	import { stepFocus } from './step-focus.svelte.ts';
	import RulesAtSetting from './RulesAtSetting.svelte';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { pendingTray, trayItems, withoutOffSeat, type BankView } from './setup-tray.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import HeldReminderDialog from './HeldReminderDialog.svelte';
	import { campaignOf } from '#lib/features/modes/campaigns.ts';
	import { hasSpectatorVote } from '#lib/features/modes/specters.ts';
	import { townGroupOf } from '#lib/features/modes/town-groups.ts';
	import { extraReminders, onBoard } from './reminders.ts';
	import AlignmentAsk from './AlignmentAsk.svelte';
	import GameEndPrompt from './GameEndPrompt.svelte';

	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	// Once every tile is drawn the bag and selection are closed; seats change here instead.
	const setUp = $derived(setupComplete(game));
	const characters = $derived(grimoire.open.characters);
	const seats = $derived(game.seating.map((id) => game.seats[id]));

	let board = $state<HTMLElement>();
	let width = $state(0);
	let height = $state(0);
	// Measured on the next frame rather than with bind:clientWidth, so resizing the tokens
	// never re-enters the ResizeObserver callback (a "ResizeObserver loop" error).
	$effect(() => {
		if (!board) return;
		let frame = 0;
		const observer = new ResizeObserver(([entry]) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			});
		});
		observer.observe(board);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	const layout = $derived(grimoire.layout);
	// The token size setting is applied here, within the spacing, so seats never overlap; the
	// tokens on the ring then draw at exactly this size (SeatToken resets --token-scale).
	const tokenScale = $derived(preferences.current.tokenAppearance.tokenScale);
	const reminderScale = $derived(preferences.current.tokenAppearance.reminderScale);
	const size = $derived(seatTokenSize(game.seating, layout, { width, height }, tokenScale));
	// The Token size preview in Settings draws at this board's size.
	$effect(() => rememberBoard({ width, height, seating: game.seating, layout }));
	// Each seat's slot is its token plus one --u (16px, unscaled by text size) either side;
	// keep it all on the board so a narrow phone never scrolls sideways.
	const unit = 16;
	const points = $derived(
		keepInside(
			seatPoints(game.seating, layout, { width, height }),
			{ width, height },
			size / 2 + unit
		)
	);

	// ── Player names, then reminders ──
	// A name goes beneath its token unless that is covered (name-placement.ts); each seat's
	// reminders then line up in front of it, towards the middle, clear of the name, and
	// every one is shown so each can be dragged (reminder-fan.ts).
	const chip = $derived(Math.round(Math.max(30, Math.min(48, size * 0.5)) * reminderScale));
	let rootFont = $state(16);
	$effect(() => {
		void preferences.current;
		rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	});
	const toPx = (p: SeatPoint) => ({ x: (p.x / 100) * width, y: (p.y / 100) * height });
	const toPercent = (p: { x: number; y: number }): SeatPoint => ({
		x: (p.x / width) * 100,
		y: (p.y / height) * 100
	});
	/** Each seat's name, its box in px (the badge: 0.8rem text, padding and border). */
	const nameBoxes = $derived.by(() => {
		if (width <= 0 || height <= 0) return [];
		const font = rootFont * 0.8;
		const lineHeight = Math.ceil(font * 1.2 + font * 0.3 + 2);
		const widths = seats.map((seat, i) => {
			const name = seat.playerName ?? `Seat ${i + 1}`;
			return Math.min(size + 2 * unit, name.length * font * 0.55 + font + 2);
		});
		const centres = shown.map(toPx);
		const places = placeNames({
			seats: centres,
			size,
			widths,
			height: lineHeight,
			obstacles: [],
			board: { width, height }
		});
		return places.map((place, i) => ({
			place,
			box: nameBox(centres[i], place, size, widths[i], lineHeight)
		}));
	});
	const namePlaces = $derived(nameBoxes.map((n) => n.place));
	/**
	 * The script's name in the corner keeps clear of every seat and name (Trevor, 2026-10-18),
	 * cut short with an ellipsis where it would reach one (always the lower left).
	 */
	const corner = $derived.by(() => {
		const boxes = shown.flatMap((p, i) => {
			const c = toPx(p);
			const name = nameBoxes[i]?.box;
			// The token, with the name pill straddling its lower rim (PlayerNameMark).
			const token = { x: c.x, y: c.y + 0.05 * size, w: size, h: 1.1 * size };
			return name ? [token, name] : [token];
		});
		// The name sits 4px (--space-1) in from the edges.
		return cornerRoom(boxes, { width, height }, titleH + 4, 4 + 8);
	});
	/**
	 * Night order numbers for the tokens' leaf badges (Settings > Board and tokens, Trevor
	 * 2026-10-17): this game's nights, counting characters only, so they match the night list.
	 * A dead player's character drops out and the rest renumber (Trevor, 2026-10-17), except
	 * an ability set off by dying on the night of the death (the Ravenkeeper's).
	 */
	/**
	 * Whether a step wakes anyone tonight: a step for no player (Dusk, Dawn), or one with a
	 * living player, or one dead tonight whose ability is set off by dying (the Ravenkeeper's).
	 */
	const diedTonight = $derived.by(() => {
		const { entries, cursor } = grimoire.open.session.log;
		return diedSinceNewDay(entries.slice(0, cursor).flatMap((e) => e.events));
	});
	function wakes(step: NightStep): boolean {
		const holders = stepHolders(game, step, characters);
		const id = step.character?.id;
		return (
			holders.length === 0 ||
			holders.some(
				(s) => !game.seats[s].dead || (id !== undefined && id in ON_DEATH && diedTonight.has(s))
			)
		);
	}
	const nightNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || !preferences.current.tokenAppearance.nightNumbers) return undefined;
		const counts = wakes;
		return {
			first: stepNightNumbers(boardNightSteps(game, characters, 'first', data), counts),
			other: stepNightNumbers(boardNightSteps(game, characters, 'other', data), counts)
		};
	});
	/** What a seat's reminders keep off: its name, a dead seat's skull (SeatDisc), its note mark. */
	function avoidFor(i: number): Box[] {
		const out: Box[] = [];
		const c = toPx(shown[i]);
		const hasFace = seats[i]?.characterId !== undefined;
		if (!hasFace) {
			const name = nameBoxes[i]?.box;
			if (name) out.push(name);
		} else {
			// The badge pill straddles the token's lower rim (PlayerNameMark).
			out.push({ x: c.x, y: c.y + 0.5 * size, w: 0.9 * size, h: 0.18 * size });
		}
		if (seats[i]?.dead) {
			out.push({ x: c.x - 0.41 * size, y: c.y + 0.37 * size, w: 0.38 * size, h: 0.38 * size });
		}
		// The note mark, lower right (SeatToken).
		if (seats[i]?.note) {
			out.push({ x: c.x + 0.39 * size, y: c.y + 0.39 * size, w: 0.3 * size, h: 0.3 * size });
		}
		return out;
	}
	/**
	 * Every seat's reminders, laid out together so one seat's never cover another's (Trevor,
	 * 2026-10-16) and each stays nearest its own seat (2026-10-17). They are laid out at the
	 * height a finger needs (the tap target), which is what a reminder takes up on screen.
	 */
	let centreW = $state(0);
	let edgeW = $state(0);
	let edgeH = $state(0);
	let timerW = $state(0);
	let titleW = $state(0);
	let titleH = $state(0);
	let timerH = $state(0);
	let centreH = $state(0);
	let tapPx = $state(0);
	const fan = $derived.by(() => {
		if (width <= 0 || height <= 0) return seats.map((s, i) => s.reminders.map(() => shown[i]));
		const fitted = fitReminders(
			seats.map((s, i) => ({
				seat: toPx(shown[i]),
				middle: { x: width / 2, y: height / 2 },
				count: s.reminders.length,
				size,
				chip: Math.max(chip, tapPx),
				avoid: avoidFor(i)
			})),
			// The Set up button and the Fabled and Loric in the middle stay clear and tappable.
			[
				...(centreW > 0 ? [{ x: width / 2, y: height / 2, w: centreW + 12, h: centreH + 12 }] : []),
				// Fabled and Loric along the edge or grouped, in the top left corner.
				...(edgeW > 0 && boardLooks.current.rulesAt !== 'middle'
					? [{ x: edgeW / 2, y: edgeH / 2, w: edgeW + 12, h: edgeH + 12 }]
					: []),
				// The day timer, in the top right corner.
				...(timerW > 0 && showTimer
					? [{ x: width - timerW / 2, y: timerH / 2, w: timerW + 12, h: timerH + 12 }]
					: []),
				// The script's name in a lower corner.
				...(titleW > 0
					? [
							{
								x: titleW / 2,
								y: height - titleH / 2,
								w: titleW + 12,
								h: titleH + 12
							}
						]
					: [])
			],
			{ width, height }
		);
		return fitted.at.map((points) => points.map(toPercent));
	});

	interface ReminderDrag {
		reminderId: ReminderId;
		/** The seat it is on; none for a loose reminder or one a Fabled or Loric holds. */
		from: SeatId | undefined;
		/** Where the token is, in % of the board. */
		at: SeatPoint;
		target?: SeatId;
	}
	let reminderDrag = $state<ReminderDrag | undefined>();
	/**
	 * Where a dragged reminder came from (Trevor, 2026-10-16): its character, the seats that
	 * hold that character (marked on the board) and the seat it is on now.
	 */
	const dragOrigin = $derived.by(() => {
		if (!reminderDrag) return undefined;
		const id = reminderDrag.reminderId;
		const reminder = onBoard(game).find((r) => r.reminderId === id);
		if (!reminder) return undefined;
		const holders = game.seating.filter(
			(s) =>
				game.seats[s].characterId === reminder.characterId ||
				trueCharacter(game, s, characters) === reminder.characterId
		);
		return { holders, reminder };
	});

	/** The seat under a point (in % of the board), if it is within reach of a token. */
	function seatAt(at: SeatPoint): SeatId | undefined {
		let best: SeatId | undefined;
		let bestDistance = size * 0.75;
		game.seating.forEach((id, i) => {
			const d = Math.hypot(
				((points[i].x - at.x) / 100) * width,
				((points[i].y - at.y) / 100) * height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	}

	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	/**
	 * Where a free reminder may stay: on the board, but not over the reminder bank, the night
	 * walk-through, the middle's buttons, the timer or the Fabled and Loric (Trevor, 2026-10-17).
	 */
	function spotAllowed(x: number, y: number): boolean {
		if (!board) return false;
		const inside = (r: DOMRect | undefined) =>
			!!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
		if (!inside(board.getBoundingClientRect())) return false;
		const blocked = board.querySelectorAll(
			'[data-tray], [data-testid="night-strip"], .centre > *, .board-timer, .rules-edge'
		);
		return ![...blocked].some((el) => inside(el.getBoundingClientRect()));
	}
	/**
	 * The Fabled or Loric under a client point, if any: its own token, or the grouped stack
	 * (then the one whose reminder it is, else the first) (Trevor, 2026-10-17).
	 */
	function ruleAt(x: number, y: number, reminder: Reminder): CharacterId | undefined {
		const hit = document
			.elementsFromPoint(x, y)
			.map((el) => el.closest<HTMLElement>('[data-rule], [data-rule-stack]'))
			.find((el) => el !== null);
		if (!hit) return undefined;
		if (hit.dataset.rule) return hit.dataset.rule;
		return game.ruleCharacters.includes(reminder.characterId)
			? reminder.characterId
			: game.ruleCharacters[0];
	}
	/** The town group this game is a town of, if any (kept on this device). */
	const towns = $derived(townGroupOf(game.gameId));
	/** The campaign this game is part of, if any (kept on this device). */
	const campaign = $derived(campaignOf(game.gameId));
	/** Spectators vote on a shared ability in this game's mode (Specters). */
	const specters = $derived(hasSpectatorVote(game.gameId));
	let heldDialog = $state<ReturnType<typeof HeldReminderDialog>>();
	/** A Fabled or Loric's reminder being dragged off it. */
	const heldDrag = $derived.by(() => {
		const id = reminderDrag?.reminderId;
		if (!id) return undefined;
		return Object.values(game.ruleReminders ?? {})
			.flat()
			.find((r) => r.reminderId === id);
	});
	const heldLabel = (name: string) => `${name}'s reminders`;
	/** Gives a dropped spot to a reminder now loose on the board. */
	function looseAt(reminderId: ReminderId, at: SeatPoint) {
		grimoire.setReminderSpot(reminderId, at);
	}
	function dragReminder(
		reminderId: ReminderId,
		from: SeatId | undefined,
		x: number,
		y: number,
		end: boolean
	) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = seatAt(at);
		if (!end) {
			reminderDrag = {
				reminderId,
				from,
				at,
				target: boardLooks.current.reminders === 'free' ? undefined : target
			};
			return;
		}
		reminderDrag = undefined;
		// Dropped back on the setup reminders tray: it waits there again (History has it).
		const tray = board.querySelector('[data-tray]')?.getBoundingClientRect();
		if (tray && x >= tray.left && x <= tray.right && y >= tray.top && y <= tray.bottom) {
			moveConfirm?.requestReturn(reminderId);
			return;
		}
		const reminder = onBoard(game).find((r) => r.reminderId === reminderId);
		if (!reminder) return;
		// Dropped on a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17).
		const rule = ruleAt(x, y, reminder);
		if (rule) {
			if (!ruleReminders(game, rule).some((r) => r.reminderId === reminderId))
				moveConfirm?.requestRule(reminderId, rule);
			return;
		}
		// Loose mode (Trevor, 2026-10-18): nothing is given to a seat. A reminder goes where it
		// is dropped, seats included; one still on a seat from before comes off it.
		if (boardLooks.current.reminders === 'free') {
			if (!spotAllowed(x, y)) return;
			if (looseReminders(game).some((r) => r.reminderId === reminderId))
				grimoire.setReminderSpot(reminderId, at);
			else moveConfirm?.requestLoose(reminderId, () => looseAt(reminderId, at));
			return;
		}
		// Dropped on another seat: moved (one History entry).
		if (target && target !== from) moveConfirm?.request(reminderId, target);
	}

	// ── Arranging seats ──
	// Seats can be dragged anywhere (people on a couch, a gap by the door) and gaps left
	// between neighbours. Only where seats are drawn changes; the seating order does not.
	let arranging = $state(false);
	function startArranging() {
		arranging = true;
		toast(
			'Arrange seats',
			'Drag a seat anywhere to space the table, or onto another seat to change the seating order.'
		);
	}

	interface Drag {
		seatId: SeatId;
		pointerId: number;
		/** From the pointer to the seat's centre, so the seat does not jump under a finger. */
		offset: SeatPoint;
		at: SeatPoint;
		moved: boolean;
	}
	let drag = $state<Drag | undefined>();
	/** Where seats are drawn now: a dragged seat follows the finger, with its reminders. */
	const shown = $derived(
		drag ? points.map((p, i) => (game.seating[i] === drag!.seatId ? drag!.at : p)) : points
	);

	// Rotating moves the players, not the places: a hand-placed spot or a gap stays where it
	// is and whoever now sits there takes it. Also after History restores a rotation.
	let lastSeating: readonly SeatId[] = [];
	$effect(() => {
		const seating = game.seating;
		if (isRotation(lastSeating, seating) && !isDefaultLayout(grimoire.layout))
			grimoire.setLayout(followSeating(grimoire.layout, lastSeating, seating));
		lastSeating = seating;
	});
	/**
	 * Spread evenly keeps hand moves (Trevor, 2026-10-16): the seating order is first read from
	 * where seats sit around the circle, so seats renumber to match (each move is in History),
	 * then they are spaced evenly in that order.
	 */
	function spreadSeats() {
		const even = seatPoints(game.seating, spreadEvenly(layout), { width, height });
		const target = orderAround(
			game.seating,
			shown.map(toPx),
			{ x: width / 2, y: height / 2 },
			even.map(toPx)
		);
		for (let i = 0; i < target.length; i++) {
			if (game.seating[i] !== target[i])
				grimoire.run({ type: 'MoveSeat', seatId: target[i], position: i });
		}
		grimoire.setLayout(spreadEvenly(grimoire.layout));
	}
	/** Pointer movement, in pixels, before a press counts as a drag. */
	const DRAG_SLOP = 6;
	let pressedAt = { x: 0, y: 0 };

	function boardPoint(event: PointerEvent): SeatPoint {
		const rect = board!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		};
	}
	function dragStart(event: PointerEvent, seatId: SeatId, at: SeatPoint) {
		if (!arranging || drag || !board) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const p = boardPoint(event);
		pressedAt = { x: event.clientX, y: event.clientY };
		drag = {
			seatId,
			pointerId: event.pointerId,
			offset: { x: at.x - p.x, y: at.y - p.y },
			at,
			moved: false
		};
	}
	function dragMove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const moved =
			drag.moved ||
			Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >= DRAG_SLOP;
		const p = boardPoint(event);
		drag = { ...drag, moved, at: { x: p.x + drag.offset.x, y: p.y + drag.offset.y } };
	}
	/** The other seat a dragged seat is over, if any: dropping there changes the order. */
	const reorderTarget = $derived.by(() => {
		if (!drag?.moved) return undefined;
		const dragged = drag.seatId;
		let best: SeatId | undefined;
		let bestDistance = size * 0.6;
		game.seating.forEach((id, i) => {
			if (id === dragged) return;
			const d = Math.hypot(
				((points[i].x - drag!.at.x) / 100) * width,
				((points[i].y - drag!.at.y) / 100) * height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	});
	function dragEnd(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const target = reorderTarget;
		if (target) {
			// Onto another seat: the player takes that place in the seating order (one History
			// entry), and follows the ring rather than a hand-placed spot.
			const position = game.seating.indexOf(target);
			if (grimoire.run({ type: 'MoveSeat', seatId: drag.seatId, position }))
				grimoire.setLayout(withoutPlaced(layout, drag.seatId));
		} else if (drag.moved) grimoire.setLayout(withPlaced(layout, drag.seatId, drag.at));
		drag = undefined;
	}
	/** Arrow keys move a seat while arranging, for keyboards and switch access. */
	function nudge(event: KeyboardEvent, seatId: SeatId, at: SeatPoint) {
		if (!arranging) return;
		const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[
			event.key
		];
		if (!step) return;
		event.preventDefault();
		grimoire.setLayout(withPlaced(layout, seatId, { x: at.x + step[0], y: at.y + step[1] }));
	}

	// ── Seat sheet ──
	let sheetOpen = $state(false);
	let selected = $state<SeatId | undefined>();
	function openSeat(seatId: SeatId) {
		selected = seatId;
		sheetOpen = true;
	}
	let seatSheet = $state<ReturnType<typeof SeatSheet>>();
	/**
	 * A tapped reminder opens only its own dialog, not its seat's sheet (Trevor, 2026-10-18:
	 * "they chose to open reminder, not character").
	 */
	function openReminder(seatId: SeatId, reminderId: ReminderId) {
		selected = seatId;
		// After the tap's click, so it doesn't land on what opens under the finger.
		setTimeout(() => seatSheet?.showReminder(reminderId));
	}
	// A removed (or undone) seat closes its sheet.
	$effect(() => {
		if (selected !== undefined && !game.seats[selected]) sheetOpen = false;
	});

	// ── Travellers ──
	// ── Placing a new seat: the Storyteller taps where it goes (Trevor, 2026-10-16) ──
	let placing = $state<((position: number) => void) | undefined>();
	function startPlacing(add: (position: number) => void) {
		placing = add;
		toast('Add a seat', 'Tap between two players to put the new seat there.');
	}
	/** One spot between each pair of neighbours; the one after the last seat wraps round. */
	const placeSpots = $derived(
		placing
			? shown.map((p, i) => {
					const next = shown[(i + 1) % shown.length];
					const name = (k: number) => game.seats[game.seating[k]].playerName ?? `Seat ${k + 1}`;
					return {
						position: i + 1,
						at: { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 },
						label: `Place between ${name(i)} and ${name((i + 1) % shown.length)}`
					};
				})
			: []
	);
	function placeAt(position: number) {
		const add = placing;
		placing = undefined;
		add?.(position);
	}

	// ── Setup reminders: a tray of suggested tokens in the middle of the board ──
	// ── The reminder bank under the board (Trevor, 2026-10-16): setup suggestions until
	// they are all placed or dismissed (or the first day starts), then every reminder left.
	// The Storyteller can switch at any time.
	let trayHints = $state<{ seats: SeatId[]; target?: SeatId; reminder?: Reminder }>({
		seats: []
	});
	/**
	 * While a reminder is dragged, the seats it doesn't fit are faded (Trevor, 2026-10-16:
	 * reminder target rules). Warns only: it can still be dropped there.
	 */
	const misfits = $derived.by(() => {
		// Loose mode marks no seats: nothing is given to one (Trevor, 2026-10-18).
		const reminder = looseMode ? undefined : (dragOrigin?.reminder ?? trayHints.reminder);
		if (!reminder) return new Set<SeatId>();
		return new Set(
			game.seating.filter((id) => seatMisses(game, reminder, id, characters).length > 0)
		);
	});
	/**
	 * Marks for the reminder in hand (Trevor, 2026-10-18): the seats whose character it is
	 * (its source), the seats it fits (valid targets), or both. With no reminder in hand, a
	 * walked night step marks its holders as sources.
	 */
	const looseMode = $derived(boardLooks.current.reminders === 'free');
	/** Copies beyond what the game gives (Duplicate reminder): marked as unusual. */
	const extras = $derived(extraReminders(game, characters));
	const handReminder = $derived(
		looseMode ? undefined : (dragOrigin?.reminder ?? trayHints.reminder)
	);
	const sourceSeats = $derived.by(() => {
		const id = handReminder?.characterId;
		if (id === undefined) return walkHolders;
		return game.seating.filter(
			(s) => game.seats[s].characterId === id || trueCharacter(game, s, characters) === id
		);
	});
	const targetSeats = $derived(
		handReminder ? game.seating.filter((s) => !misfits.has(s)) : trayHints.seats
	);
	function seatRole(seatId: SeatId): 'source' | 'target' | 'both' | undefined {
		const source = sourceSeats.includes(seatId);
		const target = targetSeats.includes(seatId);
		return source && target ? 'both' : source ? 'source' : target ? 'target' : undefined;
	}
	const setupPending = $derived(
		withoutOffSeat(
			pendingTray(trayItems(setupReminders(game, characters)), grimoire.trayDismissed),
			[...looseReminders(game), ...Object.values(game.ruleReminders ?? {}).flat()]
		).length
	);
	let bankChosen = $state<BankView | undefined>();
	const bankView = $derived<BankView>(
		bankChosen ?? (setupPending > 0 && game.pastDays.length === 0 ? 'setup' : 'all')
	);
	function startTray() {
		bankChosen = 'setup';
	}
	// The setup flow's last step lands here with its setup reminders in the bank.
	onMount(() => {
		if (location.hash === DAY_HASH) {
			dayOpen = true;
			replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
			return;
		}
		if (location.hash !== REMINDERS_HASH) return;
		startTray();
		replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
	});

	/** This game's ending, if it has ended (End game below). */
	let endedRead = $state(0);
	const ended = $derived((void endedRead, endedGames.read()[game.gameId]));
	/** Characters and Bag draw show in the middle until the game is set up, then go. */
	const showSetup = $derived(
		// Never while looking back through History (Trevor, 2026-10-18): it is read-only.
		!ended &&
			!grimoire.open.viewOnly &&
			!setUp &&
			!arranging &&
			!placing &&
			game.seating.some((id) => game.seats[id].characterId === undefined)
	);
	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
	// The night order, the walk-through and the open step come back after a reload or an
	// update (Trevor, 2026-10-16), from what this device saved.
	const saved = untrack(() => grimoire.nightView);
	let nightOpen = $state(saved.sheet === true);
	/** The day sheet; the old /day route lands here with `#day` to open it. */
	let dayOpen = $state(false);
	// ── Assisted night order (Trevor, 2026-10-16) ──
	let guided = $state<{ step: NightStep; night: Night } | undefined>();
	let guideOpen = $state(false);
	/** Walking through the night under the board: which night and which step. */
	let walk = $state<{ night: Night; index: number } | undefined>(saved.walk);
	// Run Night Order leaves out dead players (Trevor, 2026-10-18) unless their ability is set
	// off by dying tonight; the night order sheet still lists every step, to open by hand.
	const walkSteps = $derived.by(() => {
		const data = officialData.current;
		return walk && data ? boardNightSteps(game, characters, walk.night, data).filter(wakes) : [];
	});
	/** The open step's night, for Previous and Next inside it, skipping the dead likewise. */
	const guidedSteps = $derived.by(() => {
		const data = officialData.current;
		if (!guided || !data) return [];
		const open = guided.step.id;
		return boardNightSteps(game, characters, guided.night, data).filter(
			(s) => s.id === open || wakes(s)
		);
	});
	// The saved step dialog opens once the night order can be worked out.
	let guidedPending = $state(saved.guided);
	$effect(() => {
		const data = officialData.current;
		if (!guidedPending || !data) return;
		const { night, stepId } = guidedPending;
		guidedPending = undefined;
		const step = boardNightSteps(game, characters, night, data).find((s) => s.id === stepId);
		if (step) {
			guided = { step, night };
			guideOpen = true;
		}
	});
	$effect(() => {
		grimoire.saveNightView({
			sheet: nightOpen || undefined,
			walk: walk ? { ...walk } : undefined,
			guided: guideOpen && guided ? { night: guided.night, stepId: guided.step.id } : guidedPending
		});
	});
	const walkStep = $derived(walk ? walkSteps[walk.index] : undefined);
	/**
	 * Run Night Order in one tap, from the right end of the reminder bank (Trevor, 2026-10-18:
	 * a change on the board itself, not a toolbar page). Always there while the walk-through
	 * setting is on, so the bank never moves; usable once every seat has a token. It starts
	 * tonight's walk-through at the first step not yet done.
	 */
	const canRun = $derived(
		!showSetup &&
			!ended &&
			!grimoire.open.viewOnly &&
			!walk &&
			!arranging &&
			!placing &&
			game.seating.length > 0 &&
			game.seating.every((id) => game.seats[id].characterId !== undefined)
	);
	function runNight() {
		const data = officialData.current;
		if (!data) return;
		grimoire.beginNight();
		const night = tonight(game);
		const steps = boardNightSteps(game, characters, night, data).filter(wakes);
		const next = steps.findIndex((step) => !grimoire.isNightStepDone(night, step));
		walk = { night, index: Math.max(0, next) };
	}
	/**
	 * A night is running (walked through, or Dusk ticked by End day): the bank's button is End
	 * night, which replaces ticking Dawn (Trevor, 2026-10-18). With the walk-through switched
	 * off it is End night all the time, usable while a night runs.
	 */
	const nightOn = $derived(!ended && (walk !== undefined || grimoire.nightRunning));
	let endNightOpen = $state(false);
	function endNight() {
		if (!grimoire.endNight()) return;
		walk = undefined;
		dayOpen = true;
	}
	/**
	 * The step's reminders already on the board are ringed too, on any night (Trevor,
	 * 2026-10-18: the Butler's Master placed on the first night).
	 */
	const walkLabels = $derived(
		walk && walkStep?.character
			? new Set([
					...stepReminders(walkStep.character.id, walk.night, walkStep.character).labels,
					...walkStep.character.reminders
				])
			: undefined
	);
	const walkOn = (r: { characterId: CharacterId; label: string }) =>
		walkStep?.character?.id === r.characterId && (walkLabels?.has(r.label) ?? false);
	/** Who wakes for the current walk-through step, marked on the board. */
	const walkHolders = $derived(walkStep ? stepHolders(game, walkStep, characters) : []);

	// ── End game (Trevor, 2026-10-16): the game moves to History; its live room closes ──
	// The Storyteller stays on the board, which says the game is over (Trevor, 2026-10-17).
	let endOpen = $state(false);
	let winner = $state<'good' | 'evil' | undefined>();
	function endGame() {
		endOpen = false;
		endedGames.end(game.gameId, winner);
		grimoire.open.setViewOnly(true);
		endedRead += 1;
		if (roomHost().code) roomHost().close();
	}
	// Reopening puts it back in Resume game.
	let reopenOpen = $state(false);
	function reopenGame() {
		endedGames.reopen(game.gameId);
		grimoire.open.setViewOnly(false);
		endedRead += 1;
	}
	const endedText = $derived(
		ended?.winner === 'good'
			? 'Good won'
			: ended?.winner === 'evil'
				? 'Evil won'
				: 'Winner not recorded'
	);
	/** The day timer is always on the board until the game ends (Trevor, 2026-10-17). */
	const showTimer = $derived(!ended);

	// A Traveller's alignment by draw, kept here: setting it ends the step that opened it.
	let drawFor = $state<SeatId | undefined>();
	let drawOpen = $state(false);
	function onDraw(seatId: SeatId) {
		drawFor = seatId;
		drawOpen = true;
	}

	// ── Share: one screen, the room's join code, QR and link (Trevor, 2026-10-18). Phones
	// that join get the script, never anything from the game but names and deaths. ──
	let phonesOpen = $state(false);
	// ── The players' copy of the script ──
	let scriptOpen = $state(false);
	const loadedScript = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	const boardLogo = $derived(loadedScript && scriptLogo(loadedScript));
	let menuOpen = $state(false);
	// ── Info tokens: the cards shown to players, one tap from the toolbar ──
	let infoOpen = $state(false);
	/** Where closing the info sheet goes back to, when something other than the toolbar opened it. */
	let infoReturn: (() => void) | undefined;
	const infoCharacters = $derived(
		scriptCharacterIds(game.script).flatMap((id) => characters.get(id) ?? [])
	);
	// "These characters are not in play" shows a bluff set (Trevor, 2026-10-16).
	const infoBluffSets = $derived(showableBluffSets(game, characters));
	// ── Leaving: the navigation menu (or Back) asks first; the game stays saved ──
	let exitOpen = $state(false);
	let pendingLeave: (() => void) | undefined;
	let releaseGuard: (() => void) | undefined;
	$effect(() => {
		const gameId = game.gameId;
		const release = setLeaveGuard(
			(leave) => {
				pendingLeave = leave;
				exitOpen = true;
			},
			(url) => url.pathname.startsWith(`/grimoire/${gameId}`)
		);
		releaseGuard = release;
		return release;
	});
	// ── Back (Trevor, 2026-10-17): the browser's Back, a back swipe or Android's Back button ──
	// The board adds one history entry of its own. Back first lands on the entry under it,
	// still this page: an open sheet or dialog closes, or else the board asks as for any other
	// way out. The browser runs no code for a Back that leaves the app, so the extra entry is
	// what lets it ask.
	let trapped = false;
	// After the setup and day hash handling below, which replaces the entry's state.
	onMount(() => {
		setTimeout(() => {
			if (!page.state.inGame) pushState('', { inGame: true });
			trapped = true;
		});
	});
	$effect(() => {
		const inGame = page.state.inGame;
		// Only the entry's state is watched: closing an overlay below reads other state.
		untrack(() => {
			if (inGame || !trapped) return;
			trapped = false;
			const overlay = document.querySelector(
				'[data-part="content"][data-state="open"]:is([data-scope="dialog"], [data-scope="drawer"])'
			);
			pushState('', { inGame: true });
			trapped = true;
			if (overlay) {
				// Escape closes the newest overlay (Ark's layer stack), as Back should.
				overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				return;
			}
			// Past the board's own entry and the page under it, to wherever the game was opened from.
			pendingLeave = () => history.go(-2);
			exitOpen = true;
		});
	});
	function confirmLeave() {
		exitOpen = false;
		const leave = pendingLeave;
		pendingLeave = undefined;
		// Confirmed: nothing more to ask on the way out.
		releaseGuard?.();
		leave?.();
	}

	// ── Background: an image of the Storyteller's own, kept on this device ──
	let background = $state<BackgroundChoice>({ kind: 'none' });
	let backgroundRead = $state(0);
	$effect(() => {
		void backgroundRead;
		const gameId = game.gameId;
		backgroundFor(gameId)
			.then((choice) => {
				if (game.gameId === gameId) background = choice;
			})
			.catch(() => (background = { kind: 'none' }));
	});
	/** The script's own background, only when it is a web link. */
	const scriptBackground = $derived(
		/^https:\/\//.test(game.script.meta?.background ?? '')
			? game.script.meta?.background
			: undefined
	);
	// Chosen in Board and tokens, for this game or all (Trevor, 2026-10-18).
	$effect(() =>
		boardBackground.set({
			get gameId() {
				return game.gameId;
			},
			get scriptImage() {
				return scriptBackground;
			},
			get current() {
				return background;
			},
			onChange: () => (backgroundRead += 1)
		})
	);
	let backgroundUrl = $state<string | undefined>();
	$effect(() => {
		if (background.kind === 'image') {
			const url = URL.createObjectURL(background.image);
			backgroundUrl = url;
			return () => URL.revokeObjectURL(url);
		}
		backgroundUrl = background.kind === 'script' ? scriptBackground : undefined;
	});
	/**
	 * A game played in an alternative mode says so where the script's name is (Trevor,
	 * 2026-10-18), in its own colour; the mode is the game modes thread's (game-mode-store).
	 */
	const modeName = $derived(gameModeName(game.gameId));
	/**
	 * A town's script is named after its mode ("Two Towns and a Boomdandy 1"): the name then
	 * says it once, in the mode's colour, rather than twice (Trevor, 2026-10-18).
	 */
	const modeInName = $derived(
		!!modeName && (game.script.meta?.name ?? '').toLowerCase().startsWith(modeName.toLowerCase())
	);
	const modeLabel = $derived(modeInName ? undefined : modeName);
	const showTitle = $derived(
		preferences.current.assistance.scriptTitle && !game.script.meta?.hideTitle
	);
	function fromMenu(action: () => void) {
		menuOpen = false;
		action();
	}

	// ── Fabled and Loric ──
	let ruleOpen = $state(false);
	let ruleShown = $state<CharacterId | undefined>();
	let ruleShownOpen = $state(false);
	/** Every Fabled and Loric at once, from the corner stack. */
	let rulesGroupOpen = $state(false);
	const removeRuleLabel = (name: string) => `Remove ${name} from the game`;
	let ruleRemoveOpen = $state(false);
	const ruleShownCharacter = $derived(ruleShown ? characters.get(ruleShown) : undefined);
</script>

<!-- Fabled and Loric are rules of the game, not seats: in the middle, or small along the edge
	(Trevor, 2026-10-17). -->
{#snippet rulesStack(stack: number)}
	<!-- One stack for them all; a tap lists every one (Trevor, 2026-10-17). -->
	<span class="stack-wrap">
		<button
			type="button"
			class="rules-stack"
			data-rule-stack
			aria-label={`Fabled and Loric: ${game.ruleCharacters.length}`}
			onclick={() => (rulesGroupOpen = true)}
		>
			{#each game.ruleCharacters.slice(0, 3) as id (id)}
				{@const character = characters.get(id)}
				{#if character}<CharacterToken {character} size={stack} />{/if}
			{/each}
			{#if game.ruleCharacters.length > 1}<span class="stack-count" aria-hidden="true"
					>{game.ruleCharacters.length}</span
				>{/if}
		</button>
		{@render heldCluster(
			Object.values(game.ruleReminders ?? {}).flat(),
			'Fabled and Loric reminders',
			() => (rulesGroupOpen = true)
		)}
	</span>
{/snippet}

<!--
	A Fabled or Loric's reminders, packed at its token's top right (Trevor, 2026-10-18): the
	latest one, which can be tapped or dragged off, and how many more, which opens the list.
-->
{#snippet heldCluster(held: ReminderInstance[], label: string, onMore: () => void)}
	{@const last = held.at(-1)}
	{#if last}
		<span class="held" role="group" aria-label={label}>
			<span class:lifted={reminderDrag?.reminderId === last.reminderId}>
				<BoardReminder
					label={last.label}
					character={characters.get(last.characterId)}
					alignment={placingAlignment(game, last.characterId, characters)}
					size={Math.round(chip * 0.7)}
					disabled={arranging}
					onTap={() => heldDialog?.show(last.reminderId)}
					onDrag={(x, y, end) => dragReminder(last.reminderId, undefined, x, y, end)}
					onCancel={() => (reminderDrag = undefined)}
				/>
			</span>
			{#if held.length > 1}
				<span class="held-more">
					<BoardReminder
						label=""
						character={undefined}
						more={held.length - 1}
						size={Math.round(chip * 0.7)}
						disabled={arranging}
						onTap={onMore}
					/>
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

<!-- A Fabled or Loric's reminders in its dialog; a tap opens one. -->
{#snippet heldList(id: CharacterId)}
	<div class="held-list" role="group" aria-label="Reminders">
		{#each ruleReminders(game, id) as reminder (reminder.reminderId)}
			<button
				type="button"
				class="held-chip"
				aria-label={reminder.label}
				onclick={() => heldDialog?.show(reminder.reminderId)}
			>
				<ReminderToken
					label={reminder.label}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder.characterId, characters)}
				/>
			</button>
		{:else}
			<span class="none">None</span>
		{/each}
	</div>
{/snippet}

{#snippet rulesList(tokenSize: number)}
	<ul class="rules" class:edge={tokenSize < size * 0.8} aria-label="Fabled and Loric">
		{#each game.ruleCharacters as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li>
					<button
						type="button"
						class="rule"
						data-rule={id}
						aria-label={character.name}
						onclick={() => {
							ruleShown = id;
							ruleShownOpen = true;
						}}
					>
						<CharacterToken {character} size={tokenSize} />
					</button>
					<!-- Its reminders, tight to its top right: parked there, out of play (Trevor,
					     2026-10-18). -->
					{@render heldCluster(ruleReminders(game, id), heldLabel(character.name), () => {
						ruleShown = id;
						ruleShownOpen = true;
					})}
				</li>
			{/if}
		{/each}
	</ul>
{/snippet}

<div class="grimoire">
	<!-- The whole screen, under the toolbar and the safe areas too (Trevor, 2026-10-18). -->
	{#if backgroundUrl}
		<div
			class="backdrop"
			data-testid="board-background"
			style:background-image={`url("${backgroundUrl}")`}
		></div>
	{:else if background.kind === 'preset'}
		<div
			class="backdrop preset"
			data-testid="board-background"
			data-preset={background.id}
			style:background={PRESETS[background.id].css}
		></div>
	{/if}
	<div class="toolbar" role="toolbar" aria-label="Grimoire">
		{#if arranging}
			<span class="title arranging-title">Arrange seats</span>
			<span class="spacer"></span>
			<IconButton
				icon="undo"
				label="Rotate players anticlockwise"
				onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'anticlockwise' })}
			/>
			<IconButton
				icon="redo"
				label="Rotate players clockwise"
				onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'clockwise' })}
			/>
			<Button
				variant="quiet"
				disabled={Object.keys(layout.placed).length === 0 && Object.keys(layout.gaps).length === 0}
				onclick={spreadSeats}>Spread evenly</Button
			>
			<Button variant="accent" icon="check" onclick={() => (arranging = false)}>Done</Button>
		{:else if placing}
			<span class="title">Add a seat</span>
			<Button variant="quiet" icon="close" onclick={() => (placing = undefined)}>Cancel</Button>
		{:else}
			<!-- The app's navigation; on the narrowest phones it is in More instead. -->
			<span class="nav-menu"><NavMenuButton /></span>
			<!-- Icons on phones; with their words on wider screens, where there is room. -->
			<span class="spacer"></span>
			<Button variant="quiet" icon="day" aria-label="Day" onclick={() => (dayOpen = true)}
				><span class="tool-label">Day</span></Button
			>
			<Button variant="quiet" icon="info" aria-label="Info tokens" onclick={() => (infoOpen = true)}
				><span class="tool-label">Info tokens</span></Button
			>
			<!-- Sharing is never hidden in the menu (Trevor, 2026-10-16). Pointing at, focusing or
			     pressing it starts opening the room, so the code and QR are ready. -->
			<Button
				variant="quiet"
				icon="share"
				aria-label="Share"
				onpointerenter={prepareRoom}
				onfocus={prepareRoom}
				onpointerdown={prepareRoom}
				onclick={() => (phonesOpen = true)}><span class="tool-label">Share</span></Button
			>
			<!-- The players' copy of the script, exactly as /play shows it (Trevor, 2026-10-16). -->
			<Button variant="quiet" icon="script" aria-label="Script" onclick={() => (scriptOpen = true)}
				><span class="tool-label">Script</span></Button
			>
			<Button variant="quiet" icon="more" aria-label="More" onclick={() => (menuOpen = true)}
				><span class="tool-label">More</span></Button
			>
		{/if}
	</div>

	<div
		class="board"
		class:arranging
		class:walking={walk !== undefined}
		class:ended={!!ended}
		style:--tray-h="{chip + 30}px"
		style:--strip-h={walk ? '7.5rem' : undefined}
		style:--name-scale={boardLooks.current.nameSize}
		bind:this={board}
	>
		<!-- The vignette darkens the background towards the edges, on every background (Trevor,
		     2026-10-17: its own switch and strength; 2026-10-18: it should be noticeable). -->
		{#if boardLooks.current.vignette}
			<div
				class="vignette"
				data-testid="vignette"
				style:--vignette={boardLooks.current.vignetteStrength}
				aria-hidden="true"
			></div>
		{/if}
		<!-- The script's logo, faint behind the seats (Trevor, 2026-10-18: his switch and opacity). -->
		{#if boardLooks.current.logo && boardLogo}
			<ScriptLogo
				src={boardLogo}
				class="board-logo"
				--logo-opacity={boardLooks.current.logoOpacity}
			/>
		{/if}
		{#each seats as seat, i (seat.seatId)}
			{@const at = shown[i]}
			<div
				class="slot"
				class:dragging={drag?.seatId === seat.seatId}
				style:left="{at.x}%"
				style:top="{at.y}%"
				onpointerdown={(event) => dragStart(event, seat.seatId, at)}
				onpointermove={dragMove}
				onpointerup={dragEnd}
				onpointercancel={() => (drag = undefined)}
				onkeydown={(event) => nudge(event, seat.seatId, at)}
				role="presentation"
			>
				<SeatToken
					{seat}
					number={i + 1}
					character={seat.characterId ? characters.get(seat.characterId) : undefined}
					{size}
					nightNumbers={nightNumbers && seat.characterId
						? {
								first: nightNumbers.first.get(seat.characterId),
								other: nightNumbers.other.get(seat.characterId)
							}
						: undefined}
					orphan={isOrphan(seat, game.script, characters)}
					dropTarget={reorderTarget === seat.seatId ||
						(reminderDrag !== undefined &&
							reminderDrag.target === seat.seatId &&
							reminderDrag.from !== seat.seatId) ||
						trayHints.target === seat.seatId}
					misfit={misfits.has(seat.seatId)}
					role={seatRole(seat.seatId)}
					namePlace={namePlaces[i] ?? 'below'}
					onTap={() => !arranging && openSeat(seat.seatId)}
				/>
			</div>
		{/each}

		{#each seats as seat, i (seat.seatId)}
			{@const count = seat.reminders.length}
			{#if count > 0}
				{@const at = fan[i]}
				{#each seat.reminders as reminder, k (reminder.reminderId)}
					{@const dragged = reminderDrag?.reminderId === reminder.reminderId}
					{@const spot =
						boardLooks.current.reminders === 'free'
							? grimoire.reminderSpots[reminder.reminderId]
							: undefined}
					{@const p = dragged ? reminderDrag!.at : (spot ?? at[k])}
					<div
						class="chip-slot"
						data-seat={i + 1}
						class:dragging={dragged}
						class:extra={extras.has(reminder.reminderId)}
						data-extra={extras.has(reminder.reminderId) ? '' : undefined}
						class:now={walkOn(reminder)}
						style:left="{p.x}%"
						style:top="{p.y}%"
					>
						<BoardReminder
							label={reminder.label}
							character={characters.get(reminder.characterId)}
							alignment={placingAlignment(game, reminder.characterId, characters)}
							size={chip}
							disabled={arranging}
							onTap={() => openReminder(seat.seatId, reminder.reminderId)}
							onDrag={(x, y, end) => dragReminder(reminder.reminderId, seat.seatId, x, y, end)}
							onCancel={() => (reminderDrag = undefined)}
						/>
					</div>
				{/each}
			{/if}
		{/each}

		<!-- Reminders that belong to no one, where they were put down (Trevor, 2026-10-17). -->
		{#each looseReminders(game) as reminder, k (reminder.reminderId)}
			{@const dragged = reminderDrag?.reminderId === reminder.reminderId}
			{@const p = dragged
				? reminderDrag!.at
				: (grimoire.reminderSpots[reminder.reminderId] ?? { x: 12 + 8 * (k % 4), y: 80 })}
			<div
				class="chip-slot"
				data-loose
				class:dragging={dragged}
				class:extra={extras.has(reminder.reminderId)}
				data-extra={extras.has(reminder.reminderId) ? '' : undefined}
				class:unassigned={!looseMode}
				data-unassigned={looseMode ? undefined : ''}
				class:now={walkOn(reminder)}
				style:left="{p.x}%"
				style:top="{p.y}%"
			>
				<BoardReminder
					label={reminder.label}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder.characterId, characters)}
					size={chip}
					disabled={arranging}
					onTap={() => heldDialog?.show(reminder.reminderId)}
					onDrag={(x, y, end) => dragReminder(reminder.reminderId, undefined, x, y, end)}
					onCancel={() => (reminderDrag = undefined)}
				/>
			</div>
		{/each}
		<!-- A Fabled or Loric's reminder follows the finger while it is dragged. -->
		{#if heldDrag}
			<div
				class="chip-slot dragging"
				style:left="{reminderDrag!.at.x}%"
				style:top="{reminderDrag!.at.y}%"
				aria-hidden="true"
			>
				<BoardReminder
					label={heldDrag.label}
					character={characters.get(heldDrag.characterId)}
					size={chip}
					disabled
					onTap={() => {}}
				/>
			</div>
		{/if}

		{#each placeSpots as spot (spot.position)}
			<button
				type="button"
				class="place-spot"
				style:left="{spot.at.x}%"
				style:top="{spot.at.y}%"
				aria-label={spot.label}
				onclick={() => placeAt(spot.position)}><Icon name="add" /></button
			>
		{/each}
		{#if reminderDrag && dragOrigin}
			{@const r = dragOrigin.reminder}
			<p class="origin" role="status">
				<ReminderToken
					label={r.label}
					character={characters.get(r.characterId)}
					alignment={placingAlignment(game, r.characterId, characters)}
				/>, from <ReminderOrigin
					{game}
					{characters}
					characterId={r.characterId}
					on={reminderDrag.from}
					interactive={false}
				/>
			</p>
		{/if}
		{#if walk}
			<NightStrip
				{grimoire}
				steps={walkSteps}
				night={walk.night}
				index={walk.index}
				onIndex={(index) => walk && (walk = { ...walk, index })}
				onOpen={(step) => {
					if (!walk) return;
					guided = { step, night: walk.night };
					guideOpen = true;
				}}
				onClose={() => (walk = undefined)}
			/>
		{/if}
		{#if ended}
			<HistoryStrip {grimoire}>
				{#snippet notice()}
					<!-- Above History's Previous and Next, out of the circle (Trevor, 2026-10-18).
					     Tapping it offers to reopen the game. -->
					<button
						type="button"
						class="game-over"
						data-testid="game-over"
						data-team={ended.winner}
						onclick={() => (reopenOpen = true)}
					>
						Game over: {endedText}{grimoire.open.session.log.cursor !== grimoire.open.savedCursor
							? ' · Shown from History'
							: ''}
					</button>
				{/snippet}
			</HistoryStrip>
		{:else}
			<ReminderBank
				{grimoire}
				{board}
				size={chip}
				view={bankView}
				onView={(v) => (bankChosen = v)}
				focus={walk && walkStep?.character
					? stepReminders(walkStep.character.id, walk.night, walkStep.character)
					: undefined}
				focusMode={stepFocus.current.mode}
				{seatAt}
				{spotAllowed}
				{ruleAt}
				onRule={(reminder, characterId) => moveConfirm?.requestRule(reminder, characterId)}
				onHints={(h) => (trayHints = h)}
				run={nightOn
					? { end: true, disabled: grimoire.open.viewOnly, onclick: () => (endNightOpen = true) }
					: preferences.current.assistance.nightWalkthrough
						? { end: false, disabled: !canRun, onclick: runNight }
						: { end: true, disabled: true, onclick: () => {} }}
			/>
		{/if}

		<!-- Measures the tap target, the height every reminder takes on the board. -->
		<span class="tap-probe" aria-hidden="true" bind:clientHeight={tapPx}></span>
		{#if boardLooks.current.rulesAt !== 'middle' && game.ruleCharacters.length > 0}
			<div class="rules-edge" bind:clientWidth={edgeW} bind:clientHeight={edgeH}>
				{#if boardLooks.current.rulesGrouped}
					{@render rulesStack(Math.max(tapPx, Math.round(size * 0.5)))}
				{:else}
					{@render rulesList(Math.max(tapPx, Math.round(size * 0.5)))}
				{/if}
			</div>
		{/if}
		{#if showTitle && game.script.meta?.name}
			<!-- Small in the lower left corner, clear of the seats (Trevor, 2026-10-17). -->
			<p
				class="corner-title"
				style:max-width={width > 0 ? `${(corner / width) * 100}%` : undefined}
				class:no-room={width > 0 && corner < 2 * rootFont}
				data-testid="script-title"
				bind:clientWidth={titleW}
				bind:clientHeight={titleH}
			>
				<span
					class="script-name"
					class:mode={modeInName}
					data-testid={modeInName ? 'game-mode' : undefined}>{game.script.meta.name}</span
				>
				<!-- The mode takes the author's line, so the corner never grows. -->
				{#if modeLabel}<span class="mode" data-testid="game-mode">{modeLabel}</span
					>{:else if game.script.meta?.author}<span class="author"
						>by {game.script.meta.author}</span
					>{/if}
			</p>
		{/if}
		{#if showTimer}
			<!-- The day timer on the board too (Trevor, 2026-10-17); one timer for the app. -->
			<div class="board-timer" bind:clientWidth={timerW} bind:clientHeight={timerH}>
				<DayTimer alive={livingByTeam(game).alive} variant="compact" />
			</div>
		{/if}
		<div class="centre" bind:clientWidth={centreW} bind:clientHeight={centreH}>
			<!-- Until the game is set up: choosing characters and the bag, then out of the way. -->
			{#if showSetup}
				<div class="setup">
					<!-- One setup flow (Trevor, 2026-10-16): Characters, Draw, then the reminders. -->
					<Button
						variant="accent"
						icon="bag"
						onclick={() =>
							goto(
								currentSetupStep(game) === 'draw'
									? resolve('/grimoire/[gameId]/draw', { gameId: game.gameId })
									: resolve('/grimoire/[gameId]/setup', { gameId: game.gameId })
							)}>Set up</Button
					>
				</div>
			{/if}
			{#if boardLooks.current.rulesAt === 'middle'}
				{#if boardLooks.current.rulesGrouped && game.ruleCharacters.length > 0}
					{@render rulesStack(Math.round(size * 0.8))}
				{:else}
					{@render rulesList(Math.round(size * 0.8))}
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- Less frequent actions, in an overlay so the toolbar fits a phone. -->
<Dialog bind:open={menuOpen} title="Grimoire">
	<div class="menu">
		<Button variant="quiet" icon="history" onclick={() => fromMenu(() => (historyOpen = true))}>
			History
		</Button>
		<!-- The full night list, ticked by hand; running a night is the bank's Run night, so it
		     left the toolbar (Trevor, 2026-10-18). -->
		<Button
			variant="quiet"
			icon="night"
			onclick={() =>
				fromMenu(() => {
					grimoire.beginNight();
					nightOpen = true;
				})}
		>
			Night order
		</Button>
		<Button
			variant="quiet"
			icon="add"
			onclick={() =>
				fromMenu(() =>
					// The seat just appears; tap it to choose a character or Traveller (Trevor, 2026-10-16).
					startPlacing((position) => void grimoire.addSeat(position))
				)}
		>
			Add seat
		</Button>
		<Button variant="quiet" icon="fabled" onclick={() => fromMenu(() => (ruleOpen = true))}>
			Add Fabled or Loric
		</Button>
		<Button variant="quiet" icon="demon" onclick={() => fromMenu(() => (bluffsOpen = true))}>
			Demon bluffs
		</Button>
		<Button variant="quiet" icon="arrange" onclick={() => fromMenu(startArranging)}>
			Arrange seats
		</Button>
		<!-- Token and board settings over the board (Trevor, 2026-10-17). -->
		<Button
			variant="quiet"
			icon="settings"
			onclick={() => fromMenu(() => settingsDialog.showOnly('board'))}
		>
			Board and tokens
		</Button>
		<!-- A town of a mode game: back to all its towns (Alternative game modes). -->
		{#if towns}
			<Button
				variant="quiet"
				icon="grimoire"
				onclick={() =>
					fromMenu(() => goto(resolve('/towns/[groupId]', { groupId: towns.groupId })))}
			>
				Towns
			</Button>
		{/if}
		<!-- A game of a campaign: back to the campaign and its next game (Alternative game modes). -->
		{#if campaign}
			<Button
				variant="quiet"
				icon="grimoire"
				onclick={() =>
					fromMenu(() =>
						goto(resolve('/campaigns/[campaignId]', { campaignId: campaign.campaignId }))
					)}
			>
				Campaign
			</Button>
		{/if}
		<!-- Specters: the spectators' shared ability and vote (Alternative game modes). -->
		{#if specters}
			<Button
				variant="quiet"
				icon="vote"
				onclick={() =>
					fromMenu(() => goto(resolve('/grimoire/[gameId]/specters', { gameId: game.gameId })))}
			>
				Specters
			</Button>
		{/if}
		<!-- Leaving is through the app's navigation, which asks first (Trevor, 2026-10-16). -->
		<span class="menu-nav">
			<Button variant="quiet" icon="menu" onclick={() => fromMenu(() => navDrawer.show())}>
				Navigation
			</Button>
		</span>
		<!-- Leaving keeps the game to come back to; End moves it to History (Trevor, 2026-10-16). -->
		{#if ended}
			<Button variant="quiet" icon="undo" onclick={() => fromMenu(() => (reopenOpen = true))}>
				Reopen game
			</Button>
		{:else}
			<Button variant="danger-quiet" icon="close" onclick={() => fromMenu(() => (endOpen = true))}>
				End game
			</Button>
		{/if}
	</div>
</Dialog>

<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />
<HeldReminderDialog
	bind:this={heldDialog}
	{grimoire}
	onRemove={(id) => moveConfirm?.requestReturn(id)}
	onMove={(id, to) => moveConfirm?.request(id, to)}
/>
<AlignmentAsk {grimoire} />
<GameEndPrompt
	{grimoire}
	active={!ended && !grimoire.open.viewOnly}
	onEnd={(team) => {
		winner = team;
		endGame();
	}}
/>

<InfoTokensSheet
	bind:open={infoOpen}
	characters={infoCharacters}
	inPlay={charactersInPlay(game)}
	bluffSets={infoBluffSets}
	onChooseBluffs={() => {
		infoReturn = undefined;
		bluffsOpen = true;
	}}
	onclose={() => {
		const back = infoReturn;
		infoReturn = undefined;
		back?.();
	}}
/>

<!-- Like the day's End day: the title alone (DaySheet). -->
<ConfirmDialog bind:open={endNightOpen} title="End the night?" onConfirm={endNight} />

<ConfirmDialog bind:open={exitOpen} title="Leave the game?" onConfirm={confirmLeave}>
	<dl class="change">
		<dt>Now</dt>
		<dd>In the grimoire for {game.script.meta?.name ?? 'this game'}</dd>
		<dt>Becomes</dt>
		<dd>The game stays saved and opens again from Resume game.</dd>
	</dl>
</ConfirmDialog>

<ConfirmDialog bind:open={reopenOpen} title="Reopen game?" onConfirm={reopenGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd>Ended, in History: {endedText}</dd>
		<dt>Becomes</dt>
		<dd>In Resume game</dd>
	</dl>
</ConfirmDialog>

<ConfirmDialog bind:open={endOpen} title="End game?" danger onConfirm={endGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd>In Resume game</dd>
		<dt>Becomes</dt>
		<dd>Ended, in History</dd>
	</dl>
	<div class="winner">
		<Select
			label="Winner"
			value={winner ?? 'none'}
			options={[
				{ value: 'good', label: 'Good' },
				{ value: 'evil', label: 'Evil' },
				{ value: 'none', label: 'Not recorded' }
			]}
			onChange={(team) => (winner = team === 'none' ? undefined : team)}
		/>
	</div>
</ConfirmDialog>

<SeatSheet bind:this={seatSheet} bind:open={sheetOpen} {grimoire} seatId={selected} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

<Dialog bind:open={scriptOpen} title={game.script.meta?.name || 'Script'} size="max">
	<!-- A max-size dialog doesn't scroll itself: its content does. -->
	<div class="script-scroll" data-testid="script-scroll">
		{#if loadedScript}
			<!-- Exactly the players' Script and Night tabs (Trevor, 2026-10-18). -->
			<PlayerScriptTabs
				script={loadedScript}
				players={game.seating.length}
				inPlay={charactersInPlay(game)}
			/>
		{/if}
	</div>
</Dialog>

<!-- Over the board, so the Storyteller never leaves the game (Trevor, 2026-10-17). -->
<Dialog bind:open={phonesOpen} title="Players' phones" size="full">
	<RoomPanel game={grimoire.open} />
</Dialog>

<DaySheet
	bind:open={dayOpen}
	game={grimoire.open}
	onEndDay={() => {
		// The day's timer stops, and tonight's night order opens with Dusk ticked, which runs
		// the rules checked at dusk (GameEndPrompt).
		if (liveDayTimer.running) liveDayTimer.toggle();
		grimoire.beginNight();
		const night = tonight(game);
		if (!grimoire.isNightStepDone(night, { id: 'dusk' }))
			grimoire.toggleNightStep(night, { id: 'dusk' });
		nightOpen = true;
	}}
/>

<NightOrderSheet
	bind:open={nightOpen}
	{grimoire}
	onGuide={(step, night) => {
		guided = { step, night };
		guideOpen = true;
	}}
	onWalk={(night) => {
		walk = { night, index: 0 };
	}}
	{onDraw}
/>

<GuidedStep
	bind:open={guideOpen}
	{grimoire}
	step={guided?.step}
	night={guided?.night ?? 'first'}
	steps={guidedSteps}
	onStep={(step) => {
		if (!guided) return;
		guided = { step, night: guided.night };
		// The walk-through under the board follows.
		if (walk && walk.night === guided.night) {
			const i = walkSteps.findIndex((s) => s.id === step.id);
			if (i >= 0) walk = { ...walk, index: i };
		}
	}}
	onInfoTokens={() => {
		// Closing the info sheet returns to this night step (Trevor, 2026-10-16).
		infoReturn = () => (guideOpen = true);
		infoOpen = true;
	}}
	onChooseBluffs={() => (bluffsOpen = true)}
	{onDraw}
/>

<AlignmentDraw bind:open={drawOpen} {grimoire} seatId={drawFor} />

<BluffsSheet
	bind:open={bluffsOpen}
	{game}
	{characters}
	dispatch={(command) => grimoire.open.run(command)}
/>

<CharacterPicker
	bind:open={ruleOpen}
	title="Add Fabled or Loric"
	{characters}
	script={game.script}
	types={['fabled', 'loric']}
	alwaysAll
	onPick={(characterId) => {
		ruleOpen = false;
		grimoire.run({ type: 'AddRuleCharacter', characterId });
	}}
/>

<!-- eslint-disable-next-line grim/names-as-badges -- the rule character's own details, under its token -->
<Dialog bind:open={ruleShownOpen} title={ruleShownCharacter?.name ?? ''}>
	{#if ruleShownCharacter}
		<div class="rule-detail">
			<CharacterToken character={ruleShownCharacter} size={64} />
			<p>{ruleShownCharacter.ability}</p>
		</div>
		{@render heldList(ruleShownCharacter.id)}
	{/if}
	<RulesAtSetting />
	{#snippet headActions()}
		<!-- Beside the close X (Trevor, 2026-10-17); a red trash icon, named for screen readers. -->
		<DeleteButton label="Remove from the game" onclick={() => (ruleRemoveOpen = true)} />
	{/snippet}
</Dialog>

<Dialog bind:open={rulesGroupOpen} title="Fabled and Loric">
	<ul class="rules-group">
		{#each game.ruleCharacters as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li class="rule-detail">
					<CharacterToken {character} size={64} />
					<div>
						<CharacterBadge characterId={id} {character} inline />
						<p>{character.ability}</p>
						{@render heldList(id)}
					</div>
					<DeleteButton
						label={removeRuleLabel(character.name)}
						onclick={() => {
							ruleShown = id;
							ruleRemoveOpen = true;
						}}
					/>
				</li>
			{/if}
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<RulesAtSetting />
</Dialog>

<ConfirmDialog
	bind:open={ruleRemoveOpen}
	title="Remove from the game?"
	danger
	onConfirm={() => {
		ruleShownOpen = false;
		if (ruleShown) grimoire.run({ type: 'RemoveRuleCharacter', characterId: ruleShown });
	}}
>
	{#if ruleShown}
		<dl class="change">
			<dt>Now</dt>
			<dd>
				<CharacterBadge characterId={ruleShown} character={ruleShownCharacter} inline /> in play
			</dd>
			<dt>Becomes</dt>
			<dd>Not in play</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.grimoire {
		/* Its own layer, so the backdrop sits behind the toolbar and board, not the page. */
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		/* Fills the screen: a game hides the app header and footer (route data). */
		height: calc(100dvh - env(safe-area-inset-top));
		min-height: calc(20 * var(--u));
	}
	.toolbar {
		/* A fixed height, so swapping in the arranging controls never moves the board. */
		flex: none;
		box-sizing: border-box;
		height: calc(var(--tap-target) + var(--space-2));
		display: flex;
		align-items: center;
		/* One spacing step everywhere (Trevor, 2026-10-16): the same inset from the screen's
		   top and sides as the board's margin, and between buttons, narrowing only on the
		   smallest phones so six buttons still fit at 320px. No dividing line: the dashed
		   outline shows the board's edge while arranging. */
		gap: min(var(--space-2), 1.5vw);
		padding: var(--space-2) var(--space-2) 0;
	}
	/* Over a background, the toolbar's buttons get the reminder bank's backing, so they read
	   on any image (Trevor, 2026-10-18). */
	.grimoire:has(> .backdrop)
		.toolbar
		:global(button:not([data-variant='accent']):not([data-variant='danger'])) {
		background: var(--board-bar-background);
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-heading);
		color: var(--heading);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
		margin: var(--space-2);
		/* The board handles its own taps; no double-tap zoom delay. */
		touch-action: manipulation;
	}
	/* Room under the board for the docked reminder bank, and the walk-through strip. */
	.board {
		margin-bottom: calc(var(--tray-h) + 2 * var(--space-2));
	}
	/* An ended game: the game over line sits above History's Previous and Next. */
	.board.ended {
		margin-bottom: calc(var(--tray-h) + var(--tap-target) + 3 * var(--space-2));
	}
	.board.walking {
		margin-bottom: calc(var(--strip-h) + var(--tray-h) + 3 * var(--space-2));
	}
	.slot {
		position: absolute;
		translate: -50% -50%;
	}
	/* While arranging, a press drags a seat instead of scrolling or zooming. */
	.arranging {
		touch-action: none;
		outline: 1px dashed var(--border);
		outline-offset: var(--space-1);
		border-radius: var(--radius-md);
	}
	.arranging .slot {
		cursor: grab;
	}
	.slot.dragging {
		z-index: 2;
		cursor: grabbing;
	}
	.place-spot {
		position: absolute;
		z-index: 3;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		translate: -50% -50%;
		border: 2px dashed var(--accent);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--accent);
		cursor: pointer;
	}
	.place-spot:hover {
		background: var(--surface-selected);
	}
	/* Over the top of the board while a reminder is dragged: where it came from. */
	.origin {
		position: absolute;
		top: var(--space-1);
		left: 50%;
		z-index: 4;
		max-width: calc(100% - 2 * var(--space-2));
		margin: 0;
		padding: var(--space-1) var(--space-2);
		translate: -50% 0;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}
	.chip-slot {
		position: absolute;
		translate: -50% -50%;
		z-index: 1;
	}
	/* Back in attached mode, a reminder left loose belongs to no seat (Trevor, 2026-10-18): a
	   dashed ring until it is put on a seat or back in the bank. */
	/* A copy beyond what the game gives (Trevor, 2026-10-18): dashed and faded, like the
	   reminder list's tokens that don't fit a seat. */
	.chip-slot.extra > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.15rem;
		opacity: 0.75;
	}
	.chip-slot.unassigned > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.15rem;
	}
	/* The walked-through step's reminders already on the board: the bank's ring. */
	.chip-slot.now > :global(.reminder) {
		outline: 0.2rem solid var(--accent);
		outline-offset: 0.15rem;
	}
	.chip-slot.dragging {
		z-index: 3;
		scale: 1.15;
	}
	.tap-probe {
		position: absolute;
		visibility: hidden;
		height: var(--tap-target);
		pointer-events: none;
	}
	.centre {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		max-width: 50%;
	}
	.setup {
		display: grid;
		gap: var(--space-2);
	}
	.script-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* The main action on a board that isn't set up yet (Trevor, 2026-10-16): large. */
	.setup :global(.button) {
		min-height: calc(2 * var(--tap-target));
		padding-inline: var(--space-5);
		font-size: 1.35rem;
		--icon-size: 1.6rem;
	}
	/* Dimmed so seats and reminders stay clear over any image. */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		background: center / cover no-repeat;
		filter: brightness(0.45) saturate(0.85);
		pointer-events: none;
	}
	/* Built-in backgrounds are drawn for the board already: only dimmed a little. */
	.backdrop.preset {
		filter: brightness(0.8);
	}
	/* Light parchment would wash out the seat names: dimmed like an image. */
	.backdrop.preset[data-preset='parchment'] {
		filter: brightness(0.5);
	}
	.game-over {
		max-width: 100%;
		min-height: var(--tap-target);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-family: var(--font-heading);
		font-size: 1.1rem;
		pointer-events: auto;
	}
	.game-over[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.game-over[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	/* Centred in the seat ring, never wider or taller than 42% of the board; under the seats. */
	.board :global(.board-logo) {
		position: absolute;
		inset: 29%;
		opacity: var(--logo-opacity);
		pointer-events: none;
	}
	/* The vignette (Trevor, 2026-10-17: its own switch and strength), on every background. */
	.vignette {
		position: absolute;
		inset: 0;
		/* Clear in the middle, darkening to the strength at the corners. */
		background: radial-gradient(
			ellipse 75% 75% at center,
			transparent 40%,
			rgb(0 0 0 / calc(var(--vignette) * 0.6)) 75%
				/* colour-ok: a shadow is darkness, not a theme colour */,
			rgb(0 0 0 / var(--vignette)) 100% /* colour-ok: a shadow is darkness, not a theme colour */
		);
		pointer-events: none;
	}
	/* The game mode, apart from the script: small capitals in the accent colour. */
	.mode {
		color: var(--accent);
		font-family: var(--font-control);
		font-variant: small-caps;
		letter-spacing: 0.08em;
	}
	.corner-title .mode {
		font-size: 0.8em;
	}
	.spacer {
		flex: 1;
	}
	.corner-title {
		position: absolute;
		left: var(--space-1);
		bottom: var(--space-1);
		z-index: 1;
		display: grid;
		/* Until the board is measured; then as wide as the corner's room (corner-room.ts). */
		max-width: 32%;
		margin: 0;
		font-family: var(--font-heading);
		line-height: 1.15;
		color: var(--heading);
		pointer-events: none;
	}
	.corner-title.no-room {
		visibility: hidden;
	}
	/* One line each, cut short rather than wrapping up into the seats (Trevor, 2026-10-18). */
	.corner-title > span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.corner-title .script-name {
		font-size: 0.9rem;
	}
	.corner-title .author {
		font-size: 0.7rem;
		color: var(--on-surface-muted);
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.winner {
		margin-top: var(--space-3);
	}
	/* On a phone the arranging controls need the whole bar. */
	.menu-nav {
		display: none;
	}
	@media (max-width: 359.98px) {
		.nav-menu {
			display: none;
		}
		.menu-nav {
			display: contents;
		}
	}
	@media (max-width: 479.98px) {
		.arranging-title {
			display: none;
		}
	}
	/* Phones show the toolbar's icons only; wider screens add the words. */
	.toolbar :global(.tool-label) {
		display: none;
	}
	@media (max-width: 719.98px) {
		.toolbar :global(.button:has(.tool-label)) {
			min-width: var(--tap-target);
			padding: 0;
			gap: 0;
		}
	}
	@media (min-width: 720px) {
		.toolbar :global(.tool-label) {
			display: inline;
		}
	}
	.rules {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The day timer in the board's top right corner, clear of the seats' ring. */
	.board-timer {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		z-index: 2;
	}
	/* Small, in the board's top left corner, clear of the seats' ring. */
	.rules-edge {
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		max-width: 30%;
		z-index: 2;
	}
	.rules.edge {
		justify-content: flex-start;
	}
	.rules li,
	.stack-wrap {
		position: relative;
	}
	/* Packed on the token's top right corner, taking no room of its own. */
	.held {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		transform: translate(35%, -25%);
	}
	/* The "+n" tucks behind the latest reminder, which stays whole to tap. */
	.held-more {
		position: relative;
		z-index: -1;
		margin-inline-start: -30%;
	}
	/* Its stand-in follows the finger; the place stays, so nothing moves. */
	.held .lifted {
		opacity: 0.3;
	}
	.held-list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.held-chip {
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.rule {
		/* Sized from the seats, which already follow the token size setting. */
		--token-scale: 1;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.rule-detail {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.rule-detail p {
		margin: 0;
		font-family: var(--font-ability);
	}
	.rule-detail > div {
		flex: 1;
		min-width: 0;
	}
	.rules-group {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	/* The corner stack: tokens overlapping, with how many there are. */
	.rules-stack {
		position: relative;
		display: flex;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		--token-scale: 1;
	}
	.rules-stack > :global(*:not(:first-child):not(.stack-count)) {
		margin-inline-start: -60%;
	}
	.stack-count {
		position: absolute;
		right: 0;
		bottom: 0;
		min-width: 1.4em;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 0.75rem / 1.4 var(--font-control);
		text-align: center;
	}
</style>
