<script lang="ts">
	import type { EndReason, Night, NightStep } from '#lib/core/rules/index.ts';
	import GuidedStep from './GuidedStep.svelte';
	import NightStrip from './NightStrip.svelte';
	import HistoryStrip from './HistoryStrip.svelte';
	import { gameModeNames } from './game-mode-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { boardNightSteps, stepHolders, tonight } from './night-steps.ts';
	import { changedCharacters, diedToday } from '#lib/core/engine/index.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import AlignmentDraw from './AlignmentDraw.svelte';
	import { endedGames } from './device-notes.ts';
	import { prepareRoom, roomHost } from '#lib/features/room/host.svelte.ts';
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { backgroundFor, PRESETS, type BackgroundChoice } from './backgrounds.ts';
	import { boardBackground } from './board-background.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import NavMenuButton from '#lib/features/shell/NavMenuButton.svelte';
	import { goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { currentSetupStep, REMINDERS_HASH } from '#lib/features/setup/setup-steps.ts';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		charactersInPlay,
		looseReminders,
		ruleReminders,
		scriptCharacterIds,
		seatNumber,
		trueCharacter,
		type Reminder,
		type ReminderInstance,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import InfoTokensSheet from '#lib/features/info-tokens/InfoTokensSheet.svelte';
	import {
		dayNumber,
		livingByTeam,
		promptApplies,
		reminderOwnerDead,
		reminderPrompt,
		type ReminderPrompt,
		setupComplete,
		diedSinceNewDay,
		ON_DEATH,
		abilityState,
		stepNightNumbers
	} from '#lib/core/rules/index.ts';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import DayTimer from '#lib/features/day/DayTimer.svelte';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import { showableBluffSets } from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
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
	import { pendingSetup, type TrayItem } from './setup-tray.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { fromScript, scriptLogo, scriptToJson } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import PlayerScriptTabs from '#lib/features/player/PlayerScriptTabs.svelte';
	import PlayerScriptActions from '#lib/features/player/PlayerScriptActions.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import {
		publicTravellerTest,
		travellersInPlay
	} from '#lib/features/player/travellers-in-play.ts';
	import { publicProjection } from '#lib/core/sync/public-projection.ts';
	import HistoryDialog from './HistoryDialog.svelte';
	import DaySheet from '#lib/features/day/DaySheet.svelte';
	import NotesSheet from './NotesSheet.svelte';
	import { DAY_HASH } from '#lib/features/day/day-hash.ts';
	import SeatSheet from './SeatSheet.svelte';
	import SeatToken from './SeatToken.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import { stepReminders } from './reminders.ts';
	import { stepFocus } from './step-focus.svelte.ts';
	import RulesAtSetting from './RulesAtSetting.svelte';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import HeldReminderDialog from './HeldReminderDialog.svelte';
	import type { GameInfoChanges } from '#lib/features/modes/GameInfoEditDialog.svelte';
	import ModeMenu from '#lib/features/modes/ModeMenu.svelte';
	import { withinModeSession } from '#lib/features/modes/mode-screens.ts';
	import {
		extraReminders,
		isGeneric,
		isSeatsReminder,
		onBoard,
		reminderWords,
		tokenLabel
	} from './reminders.ts';
	import AlignmentAsk from './AlignmentAsk.svelte';
	import type { WatchedTimer } from '#lib/features/day/watched-timer.svelte.ts';
	import EndGameFields from './EndGameFields.svelte';
	import ExportGameDialog from '#lib/features/history/ExportGameDialog.svelte';
	import { gameAt } from '#lib/features/history/recap.ts';
	import GameEndPrompt from './GameEndPrompt.svelte';
	import StarPassPrompt from './StarPassPrompt.svelte';

	interface Props {
		grimoire: Grimoire;
		/**
		 * Someone else's grimoire through the view-only link (Specters, Trevor 2026-10-18):
		 * nothing to share or change, and leaving needs no asking.
		 */
		watching?: boolean;
		/** The Storyteller's day timer, on a spectator's board. */
		watchedTimer?: WatchedTimer;
	}

	let { grimoire, watching = false, watchedTimer }: Props = $props();

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
	// The token size setting is applied here, within the spacing, so seats never overlap. It
	// sizes the board only (Trevor, 2026-10-19): tokens elsewhere keep their own size.
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
	/**
	 * The script's name in the corner keeps clear of every seat and name (Trevor, 2026-10-18),
	 * cut short with an ellipsis where it would reach one (always the lower left).
	 */
	const cornerFit = $derived.by(() => {
		const boxes = shown.flatMap((p, i) => {
			const c = toPx(p);
			const name = nameBoxes[i]?.box;
			// The token, with the name pill straddling its lower rim (PlayerNameMark).
			const off = boardLooks.current.nameOffset;
			const token = { x: c.x, y: c.y + (0.05 + off / 2) * size, w: size, h: (1.1 + off) * size };
			return name ? [token, name] : [token];
		});
		// The name sits 4px (--space-1) in from the edges.
		const room = (h: number) => cornerRoom(boxes, { width, height }, h + 4, 4 + 8);
		// A line per special rule (Trevor, 2026-10-19) when they all fit; otherwise one line,
		// as before. Both heights come from what is shown now, so the choice never flip-flops.
		const extra = Math.max(0, modeLines.length - 1) * (lineHs[0] ?? 0);
		const stackedH = stackRules ? titleH : titleH + extra;
		const stacked = room(stackedH);
		if (extra > 0 && stacked >= 2 * rootFont) return { room: stacked, stack: true };
		return { room: room(stackRules ? titleH - extra : titleH), stack: false };
	});
	/** Whether the rules show a line each now; follows cornerFit once the lines are measured. */
	// eslint-disable-next-line svelte/prefer-writable-derived -- cornerFit reads it back, so a derived would be circular
	let stackRules = $state(false);
	$effect(() => {
		stackRules = cornerFit.stack;
	});
	const corner = $derived(cornerFit.room);
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
	/** Since dawn: players whose character changed (woken tonight) and who died (Godfather). */
	const today = $derived({
		changes: changedCharacters(grimoire.open.session.log, game),
		died: diedToday(grimoire.open.session.log, game)
	});

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
			first: stepNightNumbers(boardNightSteps(game, characters, 'first', data, today), counts),
			other: stepNightNumbers(boardNightSteps(game, characters, 'other', data, today), counts)
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
			// Lower by the badge offset (Board and tokens).
			const off = boardLooks.current.nameOffset;
			out.push({ x: c.x, y: c.y + (0.5 + off) * size, w: 0.9 * size, h: 0.18 * size });
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
	/** The heights of the mode and rule lines under the script's name. */
	let lineHs = $state<number[]>([]);
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
	/**
	 * The seat last touched draws over the others where tokens overlap, its name included
	 * (Trevor, 2026-10-19). Only for this visit to the board: a reload goes back to seat order.
	 */
	let front = $state<SeatId | undefined>();
	function dragStart(event: PointerEvent, seatId: SeatId, at: SeatPoint) {
		front = seatId;
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

	/**
	 * The seat whose token is held down (Trevor, 2026-10-19): its character's reminders light
	 * up, on the board and in the bank, and everything else dims until it is let go.
	 */
	let holding = $state<SeatId | undefined>();
	function lit(reminder: Pick<Reminder, 'characterId' | 'ownerSeatId'>): boolean {
		return holding !== undefined && isSeatsReminder(game, reminder, holding, characters);
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
	 * A spectator reads, never changes (Trevor, 2026-10-19): a seat opens its character's
	 * details, as a Fabled or Loric does, not the seat sheet.
	 */
	function readCharacter(id: CharacterId | undefined) {
		const character = id ? characters.get(id) : undefined;
		if (!character) return;
		ruleDetails = character;
		ruleDetailsOpen = true;
	}

	// ── Notes (Trevor, 2026-10-19): the game's and every player's in ⋯ Notes ──
	let notesOpen = $state(false);
	let notesSheet = $state<ReturnType<typeof NotesSheet>>();
	/**
	 * A seat's pen mark opens just that player's note, not the whole sheet (Trevor,
	 * 2026-10-19: less to take in). After the tap's click, so it doesn't land in the field.
	 */
	function editNote(seatId: SeatId) {
		setTimeout(() => notesSheet?.edit(seatId));
	}
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
	const extras = $derived(extraReminders(game, characters, grimoire.copies));
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
	// The setup flow's last step lands here with its setup reminders in the bank.
	onMount(() => {
		if (location.hash === DAY_HASH) {
			dayOpen = true;
			replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
			return;
		}
		if (location.hash !== REMINDERS_HASH) return;
		replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
	});

	/** This game's ending, if it has ended (End game below). */
	let endedRead = $state(0);
	const ended = $derived((void endedRead, endedGames.read()[game.gameId]));
	/**
	 * Tokens are still to be handed out (Trevor, 2026-10-19: "if there are tokens still in the
	 * bag ... it should be Set Up"): no character chosen yet, or a bag not fully drawn. The
	 * bank's end cell says Set up until then. Characters put on seats by hand, with no bag,
	 * leave Start game there, so a game with empty seats can still start (warn, never lock).
	 */
	const showSetup = $derived(
		// Never while looking back through History (Trevor, 2026-10-18): it is read-only.
		!ended &&
			!grimoire.open.viewOnly &&
			!setUp &&
			!arranging &&
			!placing &&
			(Object.keys(game.bag?.tiles ?? {}).length > 0 ||
				!game.seating.some((id) => game.seats[id].characterId !== undefined))
	);
	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
	// The walk-through and the open step come back after a reload or an update (Trevor,
	// 2026-10-16), from what this device saved. The night order sheet left the board (Trevor,
	// 2026-10-18): the bank's Run night runs it, and the Script screen lists it.
	const saved = untrack(() => grimoire.nightView);
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
		return walk && data
			? boardNightSteps(game, characters, walk.night, data, today).filter(wakes)
			: [];
	});
	/** The open step's night, for Previous and Next inside it, skipping the dead likewise. */
	const guidedSteps = $derived.by(() => {
		const data = officialData.current;
		if (!guided || !data) return [];
		const open = guided.step.id;
		return boardNightSteps(game, characters, guided.night, data, today).filter(
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
		const step = boardNightSteps(game, characters, night, data, today).find((s) => s.id === stepId);
		if (step) {
			guided = { step, night };
			guideOpen = true;
		}
	});
	$effect(() => {
		grimoire.saveNightView({
			walk: walk ? { ...walk } : undefined,
			guided: guideOpen && guided ? { night: guided.night, stepId: guided.step.id } : guidedPending
		});
	});
	const walkStep = $derived(walk ? walkSteps[walk.index] : undefined);
	/**
	 * The rule that keeps poisoned players asleep, if the game has one (I See Dead People,
	 * https://beardytas.com/garden-of-djinn/i-see-dead-people/), and whether it applies to the
	 * walk-through's step: every player who wakes for it is poisoned.
	 */
	const poisonedSleepRule = $derived(
		readGameMode(game.gameId)?.rules.find((rule) => rule.parts.deaths?.kind === 'private')?.name
	);
	const walkAsleep = $derived.by(() => {
		if (!poisonedSleepRule || !walkStep) return false;
		const holders = stepHolders(game, walkStep, characters);
		return (
			holders.length > 0 &&
			holders.every((seatId) =>
				abilityState(game, seatId, characters).impairments.some((i) => i.reason === 'poisoned')
			)
		);
	});
	/**
	 * The rule that leaves seat 7 to no one, if the game has one (The Ballad of Seat 7,
	 * https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/), and whether that seat wakes
	 * for the walk-through's step: the Storyteller makes its choices.
	 */
	const emptySeatRule = $derived(
		readGameMode(game.gameId)?.rules.find(
			(rule) => rule.parts.seats?.kind === 'storyteller-seat' && rule.parts.seats.count > 0
		)?.name
	);
	const walkEmptySeat = $derived(
		!!emptySeatRule &&
			!!walkStep &&
			stepHolders(game, walkStep, characters).some((seatId) => seatNumber(game, seatId) === 7)
	);
	/**
	 * Run Night Order in one tap, from the right end of the reminder bank (Trevor, 2026-10-18:
	 * a change on the board itself, not a toolbar page). Always there while the walk-through
	 * setting is on, so the bank never moves; usable once a seat has a character, empty seats
	 * or not (warn, never lock: it is the only way into the night steps on the board). It
	 * starts tonight's walk-through at the first step not yet done.
	 */
	const canRun = $derived(
		!ended &&
			!grimoire.open.viewOnly &&
			!walk &&
			!arranging &&
			!placing &&
			game.seating.some((id) => game.seats[id].characterId !== undefined)
	);
	function runNight(): void {
		walkNight(false);
	}
	/** From Dusk when the night starts (Trevor, 2026-10-20), else at the first step not done. */
	function walkNight(fromDusk: boolean): void {
		const data = officialData.current;
		if (!data) return;
		grimoire.beginNight();
		const night = tonight(game);
		const steps = boardNightSteps(game, characters, night, data, today).filter(wakes);
		const next = fromDusk ? 0 : steps.findIndex((step) => !grimoire.isNightStepDone(night, step));
		walk = { night, index: Math.max(0, next) };
	}
	/**
	 * While the night is walked through, the bank's button is End night, which replaces
	 * ticking Dawn (Trevor, 2026-10-18). A walk-through stopped mid-night shows Run night
	 * again, to pick it up at the first step not done: with the night order sheet gone it is
	 * the only way back to the steps. With the walk-through switched off it is End night all
	 * the time, usable while a night runs (Dusk ticked by End day).
	 */
	const nightOn = $derived(
		!ended &&
			(walk !== undefined ||
				(grimoire.nightRunning && !preferences.current.assistance.nightWalkthrough))
	);
	let endNightOpen = $state(false);
	let endDayOpen = $state(false);
	/**
	 * End day, from the bank or the day view (Trevor, 2026-10-18): the day's timer stops and
	 * Dusk is ticked, which runs the rules checked at dusk (GameEndPrompt); the walk-through
	 * starts on the board, where it is on.
	 */
	function endDay(): void {
		if (liveDayTimer.running) liveDayTimer.toggle();
		grimoire.beginNight();
		const night = tonight(game);
		if (!grimoire.isNightStepDone(night, { id: 'dusk' }))
			grimoire.toggleNightStep(night, { id: 'dusk' });
		if (preferences.current.assistance.nightWalkthrough) walkNight(true);
	}
	/**
	 * Start game with setup reminders still in the bank's Setup stretch asks first (Trevor,
	 * 2026-10-20), listing them; Confirm starts anyway (warn, never lock).
	 */
	let setupLeft = $state<TrayItem[]>([]);
	let startAskOpen = $state(false);
	function startGame() {
		const left = pendingSetup(game, characters, grimoire.trayDismissed);
		if (left.length > 0) {
			setupLeft = left;
			startAskOpen = true;
			return;
		}
		beginGame();
	}
	function beginGame() {
		if (preferences.current.assistance.nightWalkthrough) runNight();
		else endDay();
	}
	/** Setup's next step: Characters, or the bag draw once they are chosen. */
	function openSetup() {
		goto(
			currentSetupStep(game) === 'draw'
				? resolve('/grimoire/[gameId]/draw', { gameId: game.gameId })
				: resolve('/grimoire/[gameId]/setup', { gameId: game.gameId })
		);
	}
	/**
	 * The bank's button follows the game (Trevor, 2026-10-19): Set up while tokens are still
	 * to be handed out (the game flow comes from this one button; the board has no other Set
	 * up button), then Start game before the first night, End night during a night, End day
	 * during a day; a walk-through stopped mid-night offers Run night to pick it up again.
	 */
	const bankRun = $derived.by(() => {
		if (nightOn)
			return {
				label: 'End night',
				text: 'End night',
				icon: 'day' as const,
				disabled: grimoire.open.viewOnly,
				onclick: () => {
					endNightOpen = true;
				},
				hint: endHint
			};
		const walkthrough = preferences.current.assistance.nightWalkthrough;
		if (grimoire.nightUnderway && walkthrough)
			return {
				label: 'Run Night Order',
				text: 'Run night',
				icon: 'night' as const,
				disabled: !canRun,
				onclick: runNight
			};
		// Set up stands in for Start game only: once a night or day is under way, the bank
		// ends it, characters or not.
		if (game.pastDays.length === 0 && showSetup)
			return {
				label: 'Set up',
				text: 'Set up',
				icon: 'bag' as const,
				disabled: false,
				onclick: openSetup
			};
		if (game.pastDays.length === 0)
			return {
				label: 'Start game',
				text: 'Start game',
				icon: 'night' as const,
				disabled: !canRun,
				onclick: startGame
			};
		return {
			label: 'End day',
			text: 'End day',
			icon: 'night' as const,
			disabled: !!ended || grimoire.open.viewOnly || arranging || !!placing,
			onclick: () => {
				endDayOpen = true;
			}
		};
	});

	// ── Reminders that ask (Trevor, 2026-10-19) ──
	// A reminder placed by any route (bank, sheet, drag) whose words change a player's state
	// asks first: "Dead" or "Died Today" on a living player asks to mark them dead; "Alive" on a
	// dead one asks to revive them. Which reminders ask is data (REMINDER_PROMPTS); each kind of
	// question has its words and setting below. Moving one to another seat asks too.
	// Reminders already where they were when the board opened never ask.
	const PROMPTS: Record<
		ReminderPrompt,
		{ title: string; verb: string; after: string; setting: AssistKey; dead: boolean }
	> = {
		markDead: {
			title: 'Mark dead?',
			verb: 'Mark',
			after: ' dead?',
			setting: 'deathReminderAsk',
			dead: true
		},
		revive: {
			title: 'Revive?',
			verb: 'Revive',
			after: '?',
			setting: 'reviveReminderAsk',
			dead: false
		}
	};
	let promptSeen: Set<string> | undefined;
	let promptAsk = $state<{ seatId: SeatId; prompt: ReminderPrompt }>();
	let promptAskOpen = $state(false);
	/** Where each reminder on a seat was at the last look, so a cancelled move goes back. */
	let lastSeat: Record<ReminderId, SeatId> = {};
	/**
	 * A reminder of a character whose player is dead asks first (Trevor, 2026-10-20); Cancel
	 * takes it back off, or back where it was moved from. Any other question waits for it.
	 */
	let deadAsk = $state<{ reminder: ReminderInstance; seatId: SeatId; from?: SeatId }>();
	let deadAskOpen = $state(false);
	let afterDeadAsk: { seatId: SeatId; prompt: ReminderPrompt } | undefined;
	$effect(() => {
		const fresh: { seatId: SeatId; prompt: ReminderPrompt }[] = [];
		const freshDead: { reminder: ReminderInstance; seatId: SeatId; from?: SeatId }[] = [];
		const now: string[] = [];
		const where: Record<ReminderId, SeatId> = {};
		for (const seatId of game.seating) {
			const seat = game.seats[seatId];
			for (const reminder of seat.reminders) {
				const key = `${reminder.reminderId}@${seatId}`;
				now.push(key);
				where[reminder.reminderId] = seatId;
				if (!promptSeen || promptSeen.has(key)) continue;
				if (reminderOwnerDead(game, reminder))
					freshDead.push({ reminder, seatId, from: lastSeat[reminder.reminderId] });
				const prompt = reminderPrompt(reminder.label);
				if (prompt && promptApplies(prompt, !!seat.dead)) fresh.push({ seatId, prompt });
			}
		}
		promptSeen = new Set(now);
		lastSeat = where;
		if (grimoire.open.viewOnly) return;
		const assistance = untrack(() => preferences.current.assistance);
		const ask = fresh.find(({ prompt }) => assistance[PROMPTS[prompt].setting]);
		if (assistance.deadReminderAsk && freshDead.length > 0) {
			deadAsk = freshDead[0];
			afterDeadAsk = ask;
			deadAskOpen = true;
			return;
		}
		if (!ask) return;
		promptAsk = ask;
		promptAskOpen = true;
	});
	function keepDeadReminder() {
		const next = afterDeadAsk;
		afterDeadAsk = undefined;
		if (!next) return;
		promptAsk = next;
		promptAskOpen = true;
	}
	function undoDeadReminder() {
		afterDeadAsk = undefined;
		if (!deadAsk) return;
		const { reminder, from } = deadAsk;
		if (from) {
			// Back where it was is not a new placing: it doesn't ask again.
			promptSeen = new Set([...(promptSeen ?? []), `${reminder.reminderId}@${from}`]);
			grimoire.run({ type: 'MoveReminder', reminderId: reminder.reminderId, toSeatId: from });
		} else grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId });
	}
	/** The dead seat a reminder belongs to, for the question's words. */
	function deadOwner(reminder: ReminderInstance): SeatId | undefined {
		if (reminder.ownerSeatId && game.seats[reminder.ownerSeatId]) return reminder.ownerSeatId;
		return game.seating.find(
			(id) => game.seats[id].characterId === reminder.characterId && game.seats[id].dead
		);
	}
	function endNight() {
		if (!grimoire.endNight()) return;
		walk = undefined;
		// Into the day, or stay on the grimoire (Trevor, 2026-10-18: a Storyteller setting).
		if (preferences.current.assistance.dayAfterNight) dayOpen = true;
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
	let endReason = $state<EndReason | undefined>();
	function endGame() {
		endOpen = false;
		endedGames.end(game.gameId, winner, endReason);
		grimoire.open.setViewOnly(true);
		endedRead += 1;
		if (roomHost().code) roomHost().close();
	}
	// A finished game can be saved as a recap (Trevor, 2026-10-19), as it was when it ended.
	let exportOpen = $state(false);
	const exportGame = async () => {
		const session = grimoire.open.session;
		const cursor = grimoire.open.savedCursor;
		return {
			source: {
				game: gameAt(session.log.entries, cursor) ?? game,
				entries: session.log.entries,
				cursor,
				characters,
				winner: ended?.winner,
				reason: ended?.reason
			},
			layout
		};
	};
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
	// A new day resets the day timer to the time per living player (Trevor, 2026-10-19).
	$effect(() => {
		const day = `${game.gameId}:${dayNumber(game)}`;
		untrack(() => liveDayTimer.newDay(day, livingByTeam(game).alive));
	});

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
	let infoSheet = $state<ReturnType<typeof InfoTokensSheet>>();
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
		if (watching) return;
		const gameId = game.gameId;
		const release = setLeaveGuard(
			(leave) => {
				pendingLeave = leave;
				exitOpen = true;
			},
			// This board's screens, and the other boards and pages of its mode.
			(url) => url.pathname.startsWith(`/grimoire/${gameId}`) || withinModeSession(gameId, url)
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
		if (watching) return;
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
	const modeNames = $derived(gameModeNames(game.gameId));
	/**
	 * A town's script is named after its mode ("Two Towns and a Boomdandy 1"): the name then
	 * says it once, in the mode's colour, rather than twice (Trevor, 2026-10-18).
	 */
	const modeInName = $derived(
		modeNames.length > 0 &&
			(game.script.meta?.name ?? '').toLowerCase().startsWith(modeNames[0].toLowerCase())
	);
	/** The mode, then each special rule, a line each under the name (Trevor, 2026-10-19). */
	const modeLines = $derived(modeInName ? modeNames.slice(1) : modeNames);
	const showTitle = $derived(
		preferences.current.assistance.scriptTitle && !game.script.meta?.hideTitle
	);
	/**
	 * The corner name is hidden (switched off, or no room beside the seats): Game info is
	 * then on the ⋯ menu instead, so a mode's actions stay in reach. Otherwise only the corner
	 * has it (Trevor, 2026-10-19: "remove game info and storyteller" from the menu).
	 */
	const cornerHidden = $derived(
		!(showTitle && game.script.meta?.name) || (width > 0 && corner < 2 * rootFont)
	);
	let modeMenuOpen = $state(false);
	/** Game info's pencil: only what changed becomes a command, so undo stays meaningful. */
	function editGameInfo(changes: GameInfoChanges) {
		if (changes.storytellerName !== (game.storytellerName ?? ''))
			grimoire.run({ type: 'SetStorytellerName', name: changes.storytellerName });
	}
	/** Counts Next taps past the walk-through's last step; each lights up End night. */
	let endHint = $state(0);
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
	// Tapping a Fabled or Loric token opens its entry, as a seat's token does (Trevor, 2026-10-18).
	let ruleDetails = $state<Character | undefined>();
	let ruleDetailsOpen = $state(false);
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
					label={reminderWords(last)}
					infinite={isGeneric(last)}
					symbol={last.symbol}
					character={characters.get(last.characterId)}
					alignment={placingAlignment(game, last, characters)}
					size={Math.round(chip * 0.7)}
					disabled={arranging || watching}
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
						disabled={arranging || watching}
						onTap={onMore}
					/>
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

<!-- A Fabled or Loric's reminders in its dialog; a tap opens one. -->
{#snippet heldList(id: CharacterId)}
	<!-- Nothing when it holds none; placed ones under a Reminders header (Trevor, 2026-10-18). -->
	{#if ruleReminders(game, id).length > 0}<h3 class="held-head">Reminders</h3>{/if}
	<div class="held-list" role="group" aria-label="Reminders">
		{#each ruleReminders(game, id) as reminder (reminder.reminderId)}
			<button
				type="button"
				class="held-chip"
				aria-label={reminder.label}
				disabled={watching}
				onclick={() => heldDialog?.show(reminder.reminderId)}
			>
				<ReminderToken
					label={tokenLabel(reminder)}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder, characters)}
				/>
			</button>
		{/each}
	</div>
{/snippet}

{#snippet ruleToken(character: Character)}
	<button
		type="button"
		class="rule-token"
		aria-label={`About the ${character.name}`}
		onclick={() => {
			ruleDetails = character;
			ruleDetailsOpen = true;
		}}
	>
		<CharacterToken {character} size={64} />
	</button>
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
	<!-- The vignette darkens the background towards the screen's edges, on every background
	     (Trevor, 2026-10-17: its own switch and strength; 2026-10-18: noticeable, and over the
	     whole screen like the background, not just the board). -->
	{#if boardLooks.current.vignette}
		<div
			class="vignette"
			data-testid="vignette"
			style:--vignette={boardLooks.current.vignetteStrength}
			aria-hidden="true"
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
			<span class="nav-menu" class:watching><NavMenuButton /></span>
			<!-- Icons on phones; with their words on wider screens, where there is room. A
			     spectator's board says what it is in that room (Trevor, 2026-10-19). -->
			<span class="spacer"
				>{#if watching}<span class="view-only" data-testid="view-only">View-Only</span>{/if}</span
			>
			<!-- A spectator sees every control the Storyteller does, disabled (Trevor, 2026-10-19):
			     nothing opens, so nothing invites a try. Script only shows the players' copy. -->
			<Button
				variant="quiet"
				icon="day"
				aria-label="Day"
				disabled={watching}
				onclick={() => (dayOpen = true)}><span class="tool-label">Day</span></Button
			>
			<Button
				variant="quiet"
				icon="info"
				aria-label="Info tokens"
				disabled={watching}
				onclick={() => (infoOpen = true)}><span class="tool-label">Info tokens</span></Button
			>
			<!-- Sharing is never hidden in the menu (Trevor, 2026-10-16). Pointing at, focusing or
			     pressing it starts opening the room, so the code and QR are ready. -->
			<Button
				variant="quiet"
				icon="share"
				aria-label="Share"
				disabled={watching}
				onpointerenter={prepareRoom}
				onfocus={prepareRoom}
				onpointerdown={prepareRoom}
				onclick={() => (phonesOpen = true)}><span class="tool-label">Share</span></Button
			>
			<!-- The players' copy of the script, exactly as /play shows it (Trevor, 2026-10-16). -->
			<Button variant="quiet" icon="script" aria-label="Script" onclick={() => (scriptOpen = true)}
				><span class="tool-label">Script</span></Button
			>
			<Button
				variant="quiet"
				icon="more"
				aria-label="More"
				disabled={watching}
				onclick={() => (menuOpen = true)}><span class="tool-label">More</span></Button
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
		style:--name-offset={boardLooks.current.nameOffset}
		bind:this={board}
	>
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
				class:front={front === seat.seatId}
				class:dim={holding !== undefined && holding !== seat.seatId}
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
					onTap={(part) =>
						!arranging &&
						(watching
							? readCharacter(seat.characterId)
							: part === 'note'
								? editNote(seat.seatId)
								: openSeat(seat.seatId))}
					onHold={arranging ? undefined : (on) => (holding = on ? seat.seatId : undefined)}
					onGhostVote={() =>
						!arranging &&
						!watching &&
						grimoire.run({
							type: seat.ghostVoteUsed ? 'RestoreGhostVote' : 'SpendGhostVote',
							seatId: seat.seatId
						})}
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
						class:lit={lit(reminder)}
						class:dim={holding !== undefined && !lit(reminder)}
						data-lit={lit(reminder) || undefined}
						style:left="{p.x}%"
						style:top="{p.y}%"
					>
						<BoardReminder
							label={reminderWords(reminder)}
							infinite={isGeneric(reminder)}
							symbol={reminder.symbol}
							character={characters.get(reminder.characterId)}
							alignment={placingAlignment(game, reminder, characters)}
							size={chip}
							disabled={arranging || watching}
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
				class:lit={lit(reminder)}
				class:dim={holding !== undefined && !lit(reminder)}
				data-lit={lit(reminder) || undefined}
				style:left="{p.x}%"
				style:top="{p.y}%"
			>
				<BoardReminder
					label={reminderWords(reminder)}
					infinite={isGeneric(reminder)}
					symbol={reminder.symbol}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder, characters)}
					size={chip}
					disabled={arranging || watching}
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
					label={reminderWords(heldDrag)}
					infinite={isGeneric(heldDrag)}
					symbol={heldDrag.symbol}
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
					label={tokenLabel(r)}
					character={characters.get(r.characterId)}
					alignment={placingAlignment(game, r, characters)}
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
				onPastEnd={() => endHint++}
				asleepBy={walkAsleep ? poisonedSleepRule : undefined}
				emptySeatBy={walkEmptySeat ? emptySeatRule : undefined}
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
						disabled={watching}
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
				focus={walk && walkStep?.character
					? stepReminders(walkStep.character.id, walk.night, walkStep.character)
					: undefined}
				focusMode={stepFocus.current.mode}
				{seatAt}
				{spotAllowed}
				{ruleAt}
				onRule={(reminder, characterId) => moveConfirm?.requestRule(reminder, characterId)}
				onHints={(h) => (trayHints = h)}
				run={bankRun}
				disabled={watching}
				lit={holding === undefined ? undefined : lit}
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
				<!-- A mode's name opens its actions (Alternative game modes, Trevor 2026-10-18). -->
				<ModeMenu {game} onEdit={watching ? undefined : editGameInfo}
					><span
						class="script-name"
						class:mode={modeInName}
						data-testid={modeInName ? 'game-mode' : undefined}>{game.script.meta.name}</span
					></ModeMenu
				>
				<!-- The mode and rules take the author's line: a line each where the corner has room
				     for them all (corner-room.ts), else one line joined with " + ". -->
				{#each stackRules ? modeLines : modeLines.length ? [modeLines.join(' + ')] : [] as line, i (i)}<span
						class="mode"
						data-testid="game-mode"
						bind:clientHeight={lineHs[i]}>{line}</span
					>{:else}{#if game.script.meta?.author}<span class="author"
							>by {game.script.meta.author}</span
						>{/if}{/each}
			</p>
		{/if}
		{#if showTimer}
			<!-- The day timer on the board too (Trevor, 2026-10-17); one timer for the app. -->
			<div class="board-timer" bind:clientWidth={timerW} bind:clientHeight={timerH}>
				<DayTimer
					alive={livingByTeam(game).alive}
					variant="compact"
					readOnly={watching}
					shown={watchedTimer}
				/>
			</div>
		{/if}
		<div class="centre" bind:clientWidth={centreW} bind:clientHeight={centreH}>
			<!-- Until the game is set up: choosing characters and the bag, then out of the way. -->
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
		<Button variant="quiet" icon="demon" onclick={() => fromMenu(() => (bluffsOpen = true))}>
			Demon bluffs
		</Button>
		<Button variant="quiet" icon="notes" onclick={() => fromMenu(() => (notesOpen = true))}
			>Notes</Button
		>
		{#if cornerHidden}
			<Button variant="quiet" icon="info" onclick={() => fromMenu(() => (modeMenuOpen = true))}>
				Game info
			</Button>
		{/if}
		<!-- Lines set the seats, then the settings, apart from the rest of the game, and End game
		     apart at the bottom (Trevor, 2026-10-18). -->
		<hr class="menu-rule" />
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
		<Button variant="quiet" icon="arrange" onclick={() => fromMenu(startArranging)}>
			Arrange seats
		</Button>
		<hr class="menu-rule" />
		<!-- Board and token settings over the board (Trevor, 2026-10-17); two sections since
		     2026-10-18. -->
		<Button
			variant="quiet"
			icon="boardSettings"
			onclick={() => fromMenu(() => settingsDialog.showOnly('board'))}
		>
			Board
		</Button>
		<Button
			variant="quiet"
			icon="tokenSettings"
			onclick={() => fromMenu(() => settingsDialog.showOnly('tokens'))}
		>
			Tokens
		</Button>
		<!-- Leaving is through the app's navigation, which asks first (Trevor, 2026-10-16). -->
		<span class="menu-nav">
			<Button variant="quiet" icon="menu" onclick={() => fromMenu(() => navDrawer.show())}>
				Navigation
			</Button>
		</span>
		<!-- The one Report form, straight from the game (Trevor, 2026-10-20). -->
		<Button variant="quiet" icon="report" onclick={() => fromMenu(() => reportDialog.show())}>
			{t('shell.reportIssue')}
		</Button>
		<hr class="menu-rule" />
		<!-- Leaving keeps the game to come back to; End moves it to History (Trevor, 2026-10-16). -->
		{#if ended}
			<Button variant="quiet" icon="download" onclick={() => fromMenu(() => (exportOpen = true))}>
				Export game
			</Button>
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

<ModeMenu {game} bind:open={modeMenuOpen} onEdit={watching ? undefined : editGameInfo} />
<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />
<HeldReminderDialog
	bind:this={heldDialog}
	{grimoire}
	onRemove={(id) => moveConfirm?.requestReturn(id)}
	onMove={(id, to) => moveConfirm?.request(id, to)}
/>
<AlignmentAsk {grimoire} />
<StarPassPrompt {grimoire} active={!ended && !grimoire.open.viewOnly} />
<GameEndPrompt
	{grimoire}
	active={!ended && !grimoire.open.viewOnly}
	onEnd={(team, reason) => {
		winner = team;
		endReason = reason;
		endGame();
	}}
/>

<InfoTokensSheet
	bind:this={infoSheet}
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

<!-- Like the day's End day, with its setting where it is used (Trevor, 2026-10-18). -->
{#if promptAsk && game.seats[promptAsk.seatId]}
	{@const { seatId, prompt } = promptAsk}
	{@const ui = PROMPTS[prompt]}
	{@const asked = game.seats[seatId]}
	{@const askedId = asked.characterId}
	{@const name = asked.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`}
	<ConfirmDialog
		bind:open={promptAskOpen}
		title={ui.title}
		onConfirm={() => grimoire.run({ type: 'SetDead', seatId, dead: ui.dead })}
	>
		{#snippet heading()}
			{ui.verb}
			{#if askedId}<CharacterBadge
					characterId={askedId}
					character={characters.get(askedId)}
					alignment={asked.alignment}
					playerName={name}
				/>{:else}{name}{/if}{ui.after}
		{/snippet}
		<SettingToggle
			label={ASSIST_LABELS[ui.setting].label}
			description={ASSIST_LABELS[ui.setting].description}
			checked={preferences.current.assistance[ui.setting]}
			onChange={(on) =>
				preferences.update({
					assistance: { ...preferences.current.assistance, [ui.setting]: on }
				})}
		/>
	</ConfirmDialog>
{/if}

{#if deadAsk}
	{@const { reminder } = deadAsk}
	{@const ownerId = deadOwner(reminder)}
	{@const owner = ownerId ? game.seats[ownerId] : undefined}
	<ConfirmDialog
		bind:open={deadAskOpen}
		title="Place reminder?"
		onConfirm={keepDeadReminder}
		onCancel={undoDeadReminder}
	>
		{#snippet heading()}
			Place <ReminderToken
				label={tokenLabel(reminder)}
				character={characters.get(reminder.characterId)}
				alignment={placingAlignment(game, reminder, characters)}
			/>?
		{/snippet}
		<p class="dead-owner">
			<CharacterBadge
				characterId={reminder.characterId}
				character={characters.get(reminder.characterId)}
				alignment={owner?.alignment}
				playerName={ownerId
					? (owner?.playerName ?? `Seat ${game.seating.indexOf(ownerId) + 1}`)
					: undefined}
			/> is dead.
		</p>
		<SettingToggle
			label={ASSIST_LABELS.deadReminderAsk.label}
			description={ASSIST_LABELS.deadReminderAsk.description}
			checked={preferences.current.assistance.deadReminderAsk}
			onChange={(on) =>
				preferences.update({
					assistance: { ...preferences.current.assistance, deadReminderAsk: on }
				})}
		/>
	</ConfirmDialog>
{/if}

<ConfirmDialog bind:open={startAskOpen} title="Start the game?" onConfirm={beginGame}>
	<p class="ask-note">Setup reminders not yet placed:</p>
	<ul class="setup-left" data-testid="setup-left">
		{#each setupLeft as { key, suggestion } (key)}
			<li>
				<ReminderToken
					label={suggestion.label}
					character={characters.get(suggestion.characterId)}
				/>
			</li>
		{/each}
	</ul>
</ConfirmDialog>

<ConfirmDialog bind:open={endNightOpen} title="End the night?" onConfirm={endNight}>
	<SettingToggle
		label={ASSIST_LABELS.dayAfterNight.label}
		description={ASSIST_LABELS.dayAfterNight.description}
		checked={preferences.current.assistance.dayAfterNight}
		onChange={(dayAfterNight) =>
			preferences.update({
				assistance: { ...preferences.current.assistance, dayAfterNight }
			})}
	/>
</ConfirmDialog>

<!-- The same question as the day view's End day. -->
<ConfirmDialog bind:open={endDayOpen} title={t('day.endDayConfirm')} onConfirm={endDay} />

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
		<EndGameFields {grimoire} bind:winner bind:reason={endReason} />
	</div>
</ConfirmDialog>

<SeatSheet
	bind:this={seatSheet}
	bind:open={sheetOpen}
	{grimoire}
	seatId={selected}
	onDraw={(id) => {
		sheetOpen = false;
		onDraw(id);
	}}
	onNotes={(id) => notesSheet?.edit(id)}
/>

<HistoryDialog bind:open={historyOpen} {grimoire} />

<NotesSheet bind:this={notesSheet} bind:open={notesOpen} {grimoire} />

<ExportGameDialog bind:open={exportOpen} load={exportGame} />

<!-- Exactly what players see on /play (Trevor, 2026-10-19): byline, Print, Share and tabs. -->
<Dialog bind:open={scriptOpen} title={game.script.meta?.name || 'Script'} size="max">
	{#snippet headActions()}
		<PlayerScriptActions
			script={loadedScript}
			version={scriptVersion(undefined, loadedScript?.meta)}
			share={loadedScript && {
				edition: loadedScript.edition,
				json: loadedScript.edition ? [loadedScript.edition] : scriptToJson(loadedScript),
				source: { kind: 'edition' }
			}}
		/>
	{/snippet}
	{#snippet subtitle()}
		<ScriptByline
			author={loadedScript?.meta.author}
			version={scriptVersion(undefined, loadedScript?.meta)}
			storyteller={game.storytellerName}
			inline
		/>
	{/snippet}
	<!-- A max-size dialog doesn't scroll itself: its content does. -->
	<div class="script-scroll" data-testid="script-scroll">
		{#if loadedScript}
			<PlayerScriptTabs
				script={loadedScript}
				players={game.seating.length}
				inPlay={charactersInPlay(game)}
				travellers={travellersInPlay(
					publicProjection(game, publicTravellerTest(game.gameId, characters)).seats
				)}
			/>
		{/if}
	</div>
</Dialog>

<!-- Over the board, so the Storyteller never leaves the game (Trevor, 2026-10-17). -->
<Dialog bind:open={phonesOpen} title="Players' phones" size="full">
	<RoomPanel game={grimoire.open} />
</Dialog>

<DaySheet bind:open={dayOpen} game={grimoire.open} onEndDay={endDay} />

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
	onInfoTokens={(token) => {
		// A card the step's text names opens over the step, which stays open under it.
		if (token && infoSheet) return infoSheet.openWith(token);
		// The sheet opens over the step, which stays open under it (Trevor, 2026-10-20).
		infoReturn = undefined;
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
			{@render ruleToken(ruleShownCharacter)}
			<p>{ruleShownCharacter.ability}</p>
		</div>
		{@render heldList(ruleShownCharacter.id)}
	{/if}
	<RulesAtSetting />
	{#snippet headActions()}
		<!-- Beside the close X (Trevor, 2026-10-17); a red trash icon, named for screen readers. -->
		<DeleteButton
			label="Remove from the game"
			disabled={watching}
			onclick={() => (ruleRemoveOpen = true)}
		/>
	{/snippet}
</Dialog>

{#if ruleDetails}<CharacterDialog bind:open={ruleDetailsOpen} character={ruleDetails} />{/if}

<Dialog bind:open={rulesGroupOpen} title="Fabled and Loric">
	<ul class="rules-group">
		{#each game.ruleCharacters as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li class="rule-detail">
					{@render ruleToken(character)}
					<div>
						<CharacterBadge characterId={id} {character} />
						<p>{character.ability}</p>
						{@render heldList(id)}
					</div>
					<DeleteButton
						label={removeRuleLabel(character.name)}
						disabled={watching}
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
				<CharacterBadge characterId={ruleShown} character={ruleShownCharacter} /> in play
			</dd>
			<dt>Becomes</dt>
			<dd>Not in play</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	/* Start game's question: the setup reminders still to place (Trevor, 2026-10-20). */
	.ask-note {
		margin: 0;
	}
	.setup-left {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.grimoire {
		/* Its own layer, so the backdrop sits behind the toolbar and board, not the page. */
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		/* Fills the screen: a game hides the app header and footer (route data). */
		height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
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
	/* A point on the board with its seat centred on it. */
	.slot {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 0;
		height: 0;
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
	/* Above the other seats, still under the reminders (later in the page). */
	.slot.front {
		z-index: 1;
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
	/* A held seat's reminders (Trevor, 2026-10-19): the step ring; the rest fade. */
	.chip-slot.lit > :global(.reminder) {
		outline: 0.2rem solid var(--accent);
		outline-offset: 0.15rem;
	}
	.slot.dim,
	.chip-slot.dim {
		opacity: 0.35;
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
	.script-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
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
	/* Centred on the board's playable area (Trevor, 2026-10-18), inside the seat ring: at most
	   42% of the board's width and height, the logo keeping its shape within; under the seats. */
	.board :global(.board-logo) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 42%;
		height: 42%;
		translate: -50% -50%;
		opacity: var(--logo-opacity);
		pointer-events: none;
	}
	/* The vignette (Trevor, 2026-10-17: its own switch and strength), on every background. */
	.vignette {
		position: fixed;
		inset: 0;
		z-index: -1;
		/* Clear in the middle, darkening to the strength at the corners. */
		/* The two shades are darkness, not theme colours. */
		--vignette-mid: rgb(0 0 0 / calc(var(--vignette) * 0.6)); /* colour-ok: shadow */
		--vignette-edge: rgb(0 0 0 / var(--vignette)); /* colour-ok: shadow */
		background: radial-gradient(
			ellipse 75% 75% at center,
			transparent 40%,
			var(--vignette-mid) 75%,
			var(--vignette-edge) 100%
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
		min-width: 0;
		text-align: center;
	}
	.view-only {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--evil);
		font-family: var(--font-heading);
		font-weight: 700;
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
		/* Without More, a viewer's navigation stays on the toolbar. */
		.nav-menu:not(.watching) {
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
	.held-head {
		margin: var(--space-2) 0 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--on-surface-muted);
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
	.menu-rule {
		width: 100%;
		margin: 0;
		border: 0;
		/* The menu buttons' border colour, thicker so the sections read at a glance (Trevor,
		   2026-10-19). */
		border-top: 0.125rem solid var(--border);
	}
	.rule-detail {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.rule-token {
		flex: none;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
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
