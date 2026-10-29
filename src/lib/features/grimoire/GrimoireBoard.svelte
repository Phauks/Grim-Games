<script lang="ts">
	import { offerScriptToReports } from '#lib/features/reports/report-script.svelte.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import GuidedStep from './GuidedStep.svelte';
	import NightStrip from './NightStrip.svelte';
	import HistoryStrip from './HistoryStrip.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { boardNightSteps, stepWakes } from './night-steps.ts';
	import { changedCharacters, diedToday } from '#lib/core/engine/index.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import AlignmentDraw from './AlignmentDraw.svelte';
	import { endedGames, type EndedGame } from './device-notes.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import CallTownConfirm from '#lib/features/room/CallTownConfirm.svelte';
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import { watchRootFont } from '#lib/ui/root-font.svelte.ts';
	import GameBackdrop from './GameBackdrop.svelte';
	import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import BoardLogo from '#lib/features/scripts/BoardLogo.svelte';
	import { goto, replaceState } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { REMINDERS_HASH } from '#lib/features/setup/setup-steps.ts';
	import { resolve } from '$app/paths';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		charactersInPlay,
		looseReminders,
		scriptCharacterIds,
		type ReminderInstance,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import InfoTokensSheet from '#lib/features/info-tokens/InfoTokensSheet.svelte';
	import {
		dayNumber,
		livingByTeam,
		setupComplete,
		diedSinceNewDay,
		stepNightNumbers,
		todaysNominations,
		mayNominate,
		votesWithoutToken,
		characterNominationPrompts,
		dayClaim,
		type CharacterNominationPrompt
	} from '#lib/core/rules/index.ts';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
	import { nominationPrompts, type NominationPrompt } from '#lib/core/modes/index.ts';
	import DayTimer from '#lib/features/day/DayTimer.svelte';
	import BoardActionSounds from '#lib/features/sound/BoardActionSounds.svelte';
	import BoardAmbience from '#lib/features/sound/BoardAmbience.svelte';
	import SoundboardDialog from '#lib/features/sound/SoundboardDialog.svelte';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import { showableBluffSets } from '#lib/features/bluffs/bluffs.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		followSeating,
		isDefaultLayout,
		isRotation,
		boardAspect,
		clearOfCorner,
		keepInside,
		seatPoints,
		seatTokenSize,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { rememberBoard } from '#lib/ui/seating/last-board.svelte.ts';
	import type { Box } from './name-placement.ts';
	import { SeatArranging } from './seat-arranging.svelte.ts';
	import { ReminderDragging } from './reminder-drag.svelte.ts';
	import {
		avoidBoxes,
		cornerFit,
		cornerObstacles,
		keepClear,
		nameBoxes as boardNameBoxes,
		toPercent as boardToPercent,
		toPx as boardToPx
	} from './board-geometry.ts';
	import { markBoardShown } from '#lib/ui/board-cover.ts';
	import { fitReminders } from './reminder-fan.ts';
	import { isOrphan, placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { PublicLook } from '#lib/core/sync/public-projection.ts';
	import { drawnLook } from './shared-look.ts';
	import HistoryDialog from './HistoryDialog.svelte';
	import DaySheet from '#lib/features/day/DaySheet.svelte';
	import BoardScriptDialog from './BoardScriptDialog.svelte';
	import BoardReminderChip from './BoardReminderChip.svelte';
	import BoardRules from './BoardRules.svelte';
	import CoverButton from '#lib/features/show/CoverButton.svelte';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { CoverDetails } from '#lib/features/show/CoverScreen.svelte';
	import SavantSheet from '#lib/features/savant/SavantSheet.svelte';
	import NotesSheet from './NotesSheet.svelte';
	import { DAY_HASH } from '#lib/features/day/day-hash.ts';
	import SeatSheet from './SeatSheet.svelte';
	import SeatProfileDialog from './SeatProfileDialog.svelte';
	import NominationChooser from './NominationChooser.svelte';
	import SeatToken from './SeatToken.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import ReminderTethers from './ReminderTethers.svelte';
	import { stepReminders } from './reminders.ts';
	import { stepFocus } from './step-focus.svelte.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import HeldReminderDialog from './HeldReminderDialog.svelte';
	import BoardCorner from './BoardCorner.svelte';
	import LeaveGuard from './LeaveGuard.svelte';
	import BoardMenu from './BoardMenu.svelte';
	import BoardToolbar from './BoardToolbar.svelte';
	import RuleCharacters from './RuleCharacters.svelte';
	import type { GameInfoChanges } from '#lib/features/modes/GameInfoEditDialog.svelte';
	import ModeMenu from '#lib/features/modes/ModeMenu.svelte';
	import NewGameSheet from '#lib/features/modes/NewGameSheet.svelte';
	import AlignmentAsk from './AlignmentAsk.svelte';
	import type { WatchedTimer } from '#lib/features/day/watched-timer.svelte.ts';
	import ExportGameDialog from '#lib/features/history/ExportGameDialog.svelte';
	import { screenshot } from '#lib/ui/screenshot.ts';
	import { EXPORT_HASH } from '#lib/features/history/export-hash.ts';
	import GameFeedbackSheet from '#lib/features/room/GameFeedbackSheet.svelte';
	import { gameAt } from '#lib/features/history/recap.ts';
	import EndGameDialogs from './EndGameDialogs.svelte';
	import StarPassPrompt from './StarPassPrompt.svelte';
	import FirstDeathAsk from './FirstDeathAsk.svelte';
	import ReminderAsk from './ReminderAsk.svelte';
	import { NightWalk, type NightWalkContext } from './night-walk.svelte.ts';
	import { PhaseFlow } from './phase-flow.svelte.ts';
	import { SeatHints } from './seat-hints.svelte.ts';
	import GrimCoverActions from './GrimCoverActions.svelte';
	import { BoardStatus } from './board-status.svelte.ts';
	import PhaseDialogs from './PhaseDialogs.svelte';
	import NominationAsk from './NominationAsk.svelte';

	interface Props {
		grimoire: Grimoire;
		/**
		 * Someone else's grimoire through the view-only link (Specters, Trevor 2026-10-18):
		 * nothing to share or change, and leaving needs no asking.
		 */
		watching?: boolean;
		/** The Storyteller's day timer, on a spectator's board. */
		watchedTimer?: WatchedTimer;
		/**
		 * A watched game the room says is over (the final grimoire on a phone, Trevor
		 * 2026-10-24): its History steps through on this device only.
		 */
		over?: EndedGame;
		/**
		 * A spectator who may still look through History (an admin's Live games, Trevor
		 * 2026-10-27: "Admin should have access to history"): ⋯ opens, with only History and
		 * the app's items live.
		 */
		watchedHistory?: boolean;
	}

	let { grimoire, watching = false, watchedTimer, over, watchedHistory = false }: Props = $props();
	/** Spectators on this game's view-only link, as the room reports them; none for a viewer. */
	const watcherCount = $derived(!watching && roomHost().code ? roomHost().watchers : 0);

	const game = $derived(grimoire.game);
	/** The game's settings profile: the one it was started or last played with (plan S18). */
	const profileGameId = $derived(game.gameId);
	$effect(() => {
		const gameId = profileGameId;
		if (!watching) untrack(() => settingsProfiles.openGame(gameId));
	});
	/** Characters a special rule put in play from off the script, not flagged (+1). */
	const offScriptOk = $derived(allowedOffScriptIn(game.gameId));
	// Once every tile is drawn the bag and selection are closed; seats change here instead.
	const setUp = $derived(setupComplete(game));
	const characters = $derived(grimoire.open.characters);
	/** The character whose art a generic copy shows (Trevor, 2026-10-27), if any. */
	const artOf = (reminder: ReminderInstance) =>
		reminder.like ? characters.get(reminder.like.characterId) : undefined;
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
	// Who nominated and who was nominated today, for the marks on the seats (Track nominations).
	/**
	 * A seat's nomination marks (Trevor, 2026-10-23): on every player, greyed until they
	 * happen, as the ghost vote shows on the dead. The dead may still be nominated but not
	 * nominate (Trevor, 2026-10-24), so they show only the gavel, unless their character may
	 * (`mayNominate`) or they nominated before they died.
	 */
	function seatNominationMarks(seat: { seatId: SeatId }) {
		if (!nominatedToday) return undefined;
		const made = nominatedToday.made.has(seat.seatId);
		const received = nominatedToday.received.has(seat.seatId);
		const nominates = made || mayNominate(game, seat.seatId, characters);
		return { made: nominates ? made : undefined, received };
	}
	const nominatedToday = $derived.by(() => {
		if (!gameSettings.of(game.gameId).trackNominations) return undefined;
		const today = todaysNominations(game);
		return {
			made: new Set(today.map((n) => n.nominator)),
			received: new Set(today.map((n) => n.nominee))
		};
	});
	/**
	 * The walk-through strip under the board takes this much of its height (measured, as it
	 * scales with text). Tokens are sized as if it weren't there, so starting the night only
	 * draws the seats closer together and never shrinks them (Trevor, 2026-10-23).
	 */
	const STRIP_H = '7.5rem';
	let stripReserve = $state(0);
	const sizingHeight = $derived.by(() => (nw.walk ? height + stripReserve : height));
	const size = $derived(
		seatTokenSize(game.seating, layout, { width, height: sizingHeight }, tokenScale)
	);
	// The Token size preview in Settings draws at this board's size.
	$effect(() => rememberBoard({ width, height, seating: game.seating, layout }));
	// Every shared grim keeps each seat at this board's place round the ring (Trevor, 2026-10-27).
	const aspect = $derived(boardAspect({ width, height }));
	$effect(() => {
		if (!watching) roomHost().showAspect(game.gameId, aspect);
	});
	// Each seat's slot is its token plus one --u (16px, unscaled by text size) either side;
	// keep it all on the board so a narrow phone never scrolls sideways.
	const unit = 16;
	/** The day timer's row, top right, measured: seats and reminders keep clear of it. */
	let timerW = $state(0);
	let timerH = $state(0);
	// The ring comes down just far enough to keep every seat clear of the day timer and the
	// buttons beside it (Trevor, 2026-10-27: Soundboard beside the timer), tappable on a phone.
	const onBoard = (l: typeof layout) =>
		keepInside(
			seatPoints(game.seating, l, { width, height }, watching ? grimoire.aspect : undefined),
			{ width, height },
			size / 2 + unit
		);
	const points = $derived(
		clearOfCorner(
			onBoard(layout),
			game.seating.map((id) => !layout.placed[id]),
			onBoard({ ...layout, placed: {} }),
			{ width, height },
			{ w: timerW + 12, h: timerH + 12 },
			size / 2
		)
	);

	// ── Player names, then reminders ──
	// A name goes beneath its token unless that is covered (name-placement.ts); each seat's
	// reminders then line up in front of it, towards the middle, clear of the name, and
	// every one is shown so each can be dragged (reminder-fan.ts).
	const chip = $derived(Math.round(Math.max(30, Math.min(48, size * 0.5)) * reminderScale));
	const root = watchRootFont();
	const rootFont = $derived(root.current);
	const boardSize = $derived({ width, height });
	const toPx = (p: SeatPoint) => boardToPx(p, boardSize);
	const toPercent = (p: { x: number; y: number }): SeatPoint => boardToPercent(p, boardSize);
	const nameBoxes = $derived.by(() =>
		boardNameBoxes({
			names: seats.map((seat, i) => seat.playerName ?? t('common.seat', { number: i + 1 })),
			seats: shown,
			size,
			unit,
			rootFont,
			board: boardSize
		})
	);
	/** How wide the corner may be for a given height (corner-room.ts); the name sits 4px in. */
	const cornerBoxes = $derived.by(() =>
		cornerObstacles(shown, nameBoxes, size, boardLooks.current.nameOffset, boardSize)
	);
	const fitCorner = $derived(cornerFit(cornerBoxes, boardSize));
	/** How wide the corner may be now (BoardCorner). */
	let corner = $state(0);
	/**
	 * Night order numbers for the tokens' leaf badges (Settings > Board and tokens, Trevor
	 * 2026-10-17): this game's nights, counting characters only, so they match the night list.
	 * A dead player's character drops out and the rest renumber (Trevor, 2026-10-17), except
	 * an ability set off by dying on the night of the death (the Ravenkeeper's).
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
	/** The game's special rules, kept whole with the game (game-mode-store.ts). */
	const gameRules = $derived(readGameMode(game.gameId)?.rules ?? []);
	/**
	 * Who has an ability under a special rule, when one changes it (The Phantom Detectives:
	 * the dead keep theirs, living Townsfolk have none).
	 */
	const abilitiesRule = $derived(gameRules.find((r) => r.parts.abilities)?.parts.abilities);
	const wakes = (step: NightStep): boolean =>
		stepWakes(game, step, characters, { abilitiesRule, diedTonight });
	const nightNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || preferences.current.tokenAppearance.nightLeaves !== 'numbers') return undefined;
		const counts = wakes;
		return {
			first: stepNightNumbers(
				boardNightSteps(game, characters, 'first', data, today, gameRules),
				counts
			),
			other: stepNightNumbers(
				boardNightSteps(game, characters, 'other', data, today, gameRules),
				counts
			)
		};
	});
	/** What a seat's reminders keep off: its name, skull, note mark and top-rim marks. */
	function avoidFor(i: number): Box[] {
		const seat = seats[i];
		return avoidBoxes({
			centre: toPx(shown[i]),
			size,
			hasFace: seats[i]?.characterId !== undefined,
			name: nameBoxes[i]?.box,
			dead: !!seats[i]?.dead,
			note: !!seats[i]?.notes?.length,
			nameOffset: boardLooks.current.nameOffset,
			nominations: nominatedToday !== undefined,
			orphan: !!seat && isOrphan(seat, game.script, characters, offScriptOk),
			avatar: !!seat?.characterId && !!seat.avatar
		});
	}
	/**
	 * Every seat's reminders, laid out together so one seat's never cover another's (Trevor,
	 * 2026-10-16) and each stays nearest its own seat (2026-10-17). They are laid out at the
	 * height a finger needs (the tap target), which is what a reminder takes up on screen.
	 */
	let centreW = $state(0);
	let edgeW = $state(0);
	let edgeH = $state(0);
	let titleW = $state(0);
	let titleH = $state(0);
	let centreH = $state(0);
	let tapPx = $state(0);
	const restFan = $derived.by(() => {
		if (width <= 0 || height <= 0)
			return seats.map((s, i) => Array.from({ length: s.reminders.length }, () => shown[i]));
		const fitted = fitReminders(
			seats.map((s, i) => ({
				seat: toPx(shown[i]),
				middle: { x: width / 2, y: height / 2 },
				count: s.reminders.length,
				size,
				chip: Math.max(chip, tapPx),
				avoid: avoidFor(i)
			})),
			// The Set up button and the Fabled and Loric in the middle, the Fabled and Loric along
			// the edge, the day timer and the script's name stay clear and tappable.
			keepClear({
				centre: { w: centreW, h: centreH },
				edge: boardLooks.current.rulesAt !== 'middle' ? { w: edgeW, h: edgeH } : undefined,
				timer: { w: timerW, h: timerH },
				title: { w: titleW, h: titleH },
				board: boardSize
			}),
			boardSize
		);
		return fitted.at.map((at) => at.map(toPercent));
	});
	/**
	 * While a seat is dragged, every reminder stays where it was when the seat was picked up and
	 * the seat's own go along with it, so none scatter mid-drag (Trevor, 2026-10-26); dropped,
	 * they fit around the seats again.
	 */
	let dragBase: { seatId: SeatId; at: SeatPoint; fan: SeatPoint[][] } | undefined;
	const fan = $derived.by(() => {
		const drag = seatArr.drag;
		if (!drag) {
			dragBase = undefined;
			return restFan;
		}
		if (dragBase?.seatId !== drag.seatId)
			dragBase = { seatId: drag.seatId, at: drag.at, fan: untrack(() => restFan) };
		const { at, fan: base } = dragBase;
		const i = game.seating.indexOf(drag.seatId);
		const dx = drag.at.x - at.x;
		const dy = drag.at.y - at.y;
		return base.map((spots, j) =>
			j === i ? spots.map((p) => ({ x: p.x + dx, y: p.y + dy })) : spots
		);
	});

	// ── Dragging reminders (reminder-drag.svelte.ts) ──
	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	let heldDialog = $state<ReturnType<typeof HeldReminderDialog>>();
	const remDrag = new ReminderDragging(() => ({
		grimoire,
		game,
		characters,
		points,
		size,
		board: boardSize,
		element: board,
		free: boardLooks.current.reminders === 'free',
		confirm: moveConfirm
	}));
	const dragOrigin = $derived(remDrag.origin);
	const heldDrag = $derived(remDrag.held);

	// ── Arranging seats (seat-arranging.svelte.ts) ──
	const seatArr = new SeatArranging(() => ({
		grimoire,
		seating: game.seating,
		layout,
		points,
		size,
		board: boardSize,
		element: board
	}));
	const shown = $derived(seatArr.shown);
	/**
	 * The seat picked up by a hold (Trevor, 2026-10-26): it lifts and the rest of the board
	 * darkens, so it is plain the seat can now be dragged.
	 */
	const heldSeat = $derived(seatArr.arranging ? undefined : seatArr.drag?.seatId);

	// Rotating moves the players, not the places: a hand-placed spot or a gap stays where it
	// is and whoever now sits there takes it. Also after History restores a rotation.
	let lastSeating: readonly SeatId[] = [];
	$effect(() => {
		const seating = game.seating;
		if (isRotation(lastSeating, seating) && !isDefaultLayout(grimoire.layout))
			grimoire.setLayout(followSeating(grimoire.layout, lastSeating, seating));
		lastSeating = seating;
	});
	// ── Seat sheet ──
	let sheetOpen = $state(false);
	let selected = $state<SeatId | undefined>();
	function openSeat(seatId: SeatId) {
		selected = seatId;
		sheetOpen = true;
	}
	let seatSheet = $state<ReturnType<typeof SeatSheet>>();
	// A player's avatar mark opens their profile (Trevor, 2026-10-28).
	let profileOpen = $state(false);
	let profileSeat = $state<SeatId | undefined>();
	function openProfile(seatId: SeatId) {
		profileSeat = seatId;
		profileOpen = true;
	}
	/**
	 * A spectator reads, never changes (Trevor, 2026-10-19): a seat opens its character's
	 * details, as a Fabled or Loric does, not the seat sheet.
	 */
	function readCharacter(id: CharacterId | undefined) {
		const character = id ? characters.get(id) : undefined;
		if (!character) return;
		rules?.details(character);
	}

	// ── Notes (Trevor, 2026-10-19): the game's and every player's in ⋯ Notes ──
	let notesOpen = $state(false);
	let soundboardOpen = $state(false);
	let notesSheet = $state<ReturnType<typeof NotesSheet>>();
	/**
	 * A seat's pen mark opens just that player's notes, not the whole sheet (Trevor,
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
					const name = (k: number) =>
						game.seats[game.seating[k]].playerName ?? t('common.seat', { number: k + 1 });
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
	const looseMode = $derived(boardLooks.current.reminders === 'free');
	const hints = new SeatHints(() => ({
		grimoire,
		game,
		characters,
		dragged: dragOrigin?.reminder,
		loose: looseMode,
		holders: nw.holders
	}));
	// The setup flow's last step lands here with its setup reminders in the bank.
	onMount(() => {
		// History's Export opens the board first, so the picture is the board (Trevor, 2026-10-26).
		if (location.hash === EXPORT_HASH) {
			exportOpen = true;
			replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
			return;
		}
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
	const ended = $derived(over ?? (void endedRead, endedGames.read()[game.gameId]));
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
			// Arranging or placing a token keeps Set up, disabled (Trevor, 2026-10-22: arranging
			// turned it into Start game).
			(Object.keys(game.bag?.tiles ?? {}).length > 0 ||
				!game.seating.some((id) => game.seats[id].characterId !== undefined))
	);
	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
	/** The day sheet; the old /day route lands here with `#day` to open it. */
	let dayOpen = $state(false);
	/** The Savant sheet, from the day view's Savant info button (L5). */
	let savantSeat = $state<SeatId | undefined>();
	let savantOpen = $state(false);
	/**
	 * At the end of the night, a living Savant's information is offered (Trevor, 2026-10-23:
	 * L46): a question, never a block.
	 */
	let savantAskOpen = $state(false);
	function offerSavant() {
		if (!preferences.current.assistance.savantInfo || grimoire.open.viewOnly) return;
		const seatId = game.seating.find(
			(id) =>
				dayClaim(game.seats[id].characterId ?? '', characters) === 'statements' &&
				!game.seats[id].dead
		);
		if (seatId === undefined) return;
		savantSeat = seatId;
		// After the day view has opened, if it opens too, so the question is above it.
		void tick().then(() =>
			requestAnimationFrame(() => requestAnimationFrame(() => (savantAskOpen = true)))
		);
	}
	// ── Assisted night order (Trevor, 2026-10-16): night-walk.svelte.ts ──
	// Typed, as seat sizes depend on whether the walk-through is open.
	const nw: NightWalk = new NightWalk((): NightWalkContext => ({
		grimoire,
		game,
		characters,
		data: officialData.current,
		today,
		rules: gameRules,
		wakes,
		ended: !!ended,
		busy: seatArr.arranging || !!placing
	}));
	// Ending the game (often at the dusk an Execution starts) closes the night's walk-through:
	// History's strip has the bottom of the board then (Trevor, 2026-10-24).
	$effect(() => {
		if (ended) nw.walk = undefined;
	});
	/** What a recorded nomination sets off under the game's rules (The Warrens, The Djinn's Bargain). */
	let nominationAsks = $state<(NominationPrompt | CharacterNominationPrompt)[]>([]);
	/** What a recorded nomination sets off: the game's special rules, then characters' abilities. */
	function nominated(nomination: { nominator: SeatId; nominee: SeatId }) {
		nominationAsks = [
			...nominationPrompts(grimoire.game, nomination, gameRules, characters),
			...characterNominationPrompts(grimoire.game, nomination, characters)
		];
	}
	/**
	 * The seat whose nomination marks were tapped: who did they nominate? A player who may
	 * not nominate (the dead) is asked who nominated them instead.
	 */
	let nominatingFrom = $state<{ seatId: SeatId; side: 'made' | 'received' }>();
	function askNomination(seatId: SeatId) {
		const made = seatNominationMarks({ seatId })?.made;
		nominatingFrom = { seatId, side: made === undefined ? 'received' : 'made' };
	}

	// ── From one phase to the next: the bank's button and what it asks (phase-flow.svelte.ts) ──
	const flow = new PhaseFlow(() => ({
		grimoire,
		game,
		characters,
		nw,
		showSetup,
		ended: !!ended,
		busy: seatArr.arranging || !!placing,
		setDayOpen: (open) => (dayOpen = open),
		closeSeat: () => (sheetOpen = false),
		started: () => status.started(),
		offerSavant
	}));

	// ── End game (Trevor, 2026-10-16): the game moves to History ──
	// The Storyteller stays on the board, which says the game is over (Trevor, 2026-10-17).
	// The live room stays open and tells its phones the game is over, so the table can see the
	// finished grimoire and play again in the same room (plan R1, R4, R5).
	let endOpen = $state(false);
	$effect(() => {
		const over = ended && {
			...(ended.winner ? { winner: ended.winner } : {}),
			...(ended.reason ? { reason: ended.reason } : {})
		};
		if (!watching) roomHost().setEnded(game.gameId, over || undefined);
	});
	// A finished game can be saved as a recap (Trevor, 2026-10-19), as it was when it ended.
	let exportOpen = $state(false);
	/** Players' feedback on the finished game, saved on this device (Trevor, 2026-10-25). */
	let feedbackOpen = $state(false);
	/** The whole board as drawn, for Export's picture (Trevor, 2026-10-26). */
	let grimoireEl = $state<HTMLElement>();
	const capture = (type?: 'image/png' | 'image/jpeg') => {
		if (!grimoireEl) throw new Error('the board is not shown');
		return screenshot(grimoireEl, type);
	};
	const exportGame = async () => {
		const session = grimoire.open.session;
		const cursor = grimoire.open.savedCursor;
		return {
			game: gameAt(session.log.entries, cursor) ?? game,
			entries: session.log.entries,
			cursor,
			characters,
			winner: ended?.winner,
			reason: ended?.reason
		};
	};
	// Reopening puts it back in Continue game.
	let reopenOpen = $state(false);
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

	// Sheets and dialogs over the board blur it (Trevor, 2026-10-23: game integrity).
	$effect(() => markBoardShown());

	// ── Share: one screen, the room's join code, QR and link (Trevor, 2026-10-18). Phones
	// that join get the script, never anything from the game but names and deaths. ──
	let phonesOpen = $state(false);
	/** Back to town's Cancel/Confirm, from ⋯ or from the grim cover. */
	let callTownOpen = $state(false);
	// ── The players' copy of the script ──
	let scriptOpen = $state(false);
	const loadedScript = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	// A report sent from the board carries the game's script, never the game (Trevor, 2026-10-22).
	offerScriptToReports(() => loadedScript);
	const boardLogo = $derived(loadedScript && scriptLogo(loadedScript));
	/** The look this board shares, or, watching, the look its Storyteller shared (Trevor, 2026-10-26). */
	let ownLook = $state<PublicLook>();
	let ownPicture = $state.raw<Blob>();
	const look = $derived(watching ? grimoire.look : ownLook);
	const logoOpacity = $derived(
		watching
			? drawnLook(grimoire.look).logo
			: boardLooks.current.logo
				? boardLooks.current.logoOpacity
				: undefined
	);
	function shareLook(shown: PublicLook, picture?: Blob) {
		ownLook = shown;
		ownPicture = picture;
		roomHost().showLook(game.gameId, shown, picture);
	}
	let menuOpen = $state(false);
	/** ⋯'s New game, which asks to end this game first (Trevor, 2026-10-26). */
	let newGameSheet = $state<NewGameSheet>();
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
	// ── The corner and the phones: where the game is up to (board-status.svelte.ts) ──
	const status = new BoardStatus(() => ({
		grimoire,
		game,
		characters,
		ended,
		watching,
		watchers: watcherCount
	}));
	const startedAt = $derived(status.startedAt);
	const phaseNow = $derived(status.now);
	const phase = $derived(status.text);
	const cornerInfo = $derived(status.corner);
	// Always shown, unless the script itself asks not to (Trevor, 2026-10-23: "always show
	// script name and author on board, remove as an option").
	const showTitle = $derived(!game.script.meta?.hideTitle);
	/** What the grim cover shows: nothing from the grimoire (Trevor, 2026-10-26). */
	const coverDetails = $derived<CoverDetails>({
		logo: boardLogo || undefined,
		name: showTitle ? game.script.meta?.name : undefined,
		author: showTitle ? game.script.meta?.author : undefined,
		storyteller: game.storytellerName?.trim() || undefined,
		phase
	});
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

	// ── Fabled and Loric: their dialogs (RuleCharacters) ──
	let rules = $state<ReturnType<typeof RuleCharacters>>();
</script>

{#snippet ruleTokens(tokenSize: number)}
	<BoardRules
		{game}
		{characters}
		grouped={boardLooks.current.rulesGrouped && game.ruleCharacters.length > 0}
		edge={tokenSize < size * 0.8}
		{tokenSize}
		{chip}
		disabled={seatArr.arranging || watching}
		lifted={remDrag.drag?.reminderId}
		onShow={(id) => (id ? rules?.show(id) : rules?.showAll())}
		onHeldTap={(id) => heldDialog?.show(id)}
		onHeldDrag={(id, x, y, end) => remDrag.move(id, undefined, x, y, end)}
		onCancel={() => remDrag.cancel()}
	/>
{/snippet}

<div class="grimoire" bind:this={grimoireEl}>
	<!-- The strip's share of the board's height, to size tokens without it (sizingHeight). -->
	<div
		class="strip-measure"
		aria-hidden="true"
		style:--strip-h={STRIP_H}
		bind:clientHeight={stripReserve}
	></div>
	<GameBackdrop
		{game}
		logo={boardLogo || undefined}
		watched={watching ? { look: grimoire.look, room: grimoire.room } : undefined}
		onlook={shareLook}
	/>
	<BoardToolbar
		{grimoire}
		{watching}
		menu={!watching || watchedHistory}
		{seatArr}
		placing={!!placing}
		onCancelPlacing={() => (placing = undefined)}
		onDay={() => (dayOpen = true)}
		onInfo={() => (infoOpen = true)}
		onScript={() => (scriptOpen = true)}
		onShare={() => (phonesOpen = true)}
		onMore={() => (menuOpen = true)}
	>
		<!-- The grim cover beside ☰, never in a menu (Trevor, 2026-10-26), in the same place on
		     the board and the day (2026-10-27: "so it doesn't move"); the Storyteller's only. -->
		{#snippet lead()}
			{#if !watching}
				<CoverButton
					gameId={game.gameId}
					details={coverDetails}
					timer={coverTimer}
					actions={coverActions}
					outlined
				/>
			{/if}
		{/snippet}
	</BoardToolbar>

	<div
		class="board"
		class:arranging={seatArr.arranging}
		class:holding={heldSeat !== undefined}
		class:walking={nw.walk !== undefined}
		class:ended={!!ended}
		style:--tray-h="{chip + 30}px"
		style:--strip-h={nw.walk ? STRIP_H : undefined}
		style:--name-scale={boardLooks.current.nameSize}
		style:--name-offset={boardLooks.current.nameOffset}
		bind:this={board}
	>
		<!-- The script's logo, or its name, faint behind the seats (Trevor, 2026-10-18: his
			switch and opacity; 2026-10-27: the name when there is no logo). -->
		{#if logoOpacity !== undefined}
			<BoardLogo
				src={boardLogo || undefined}
				name={showTitle ? game.script.meta?.name : undefined}
				opacity={logoOpacity}
				height={sizingHeight > 0 ? `${Math.round(0.42 * sizingHeight)}px` : undefined}
			/>
		{/if}
		<!-- Each seat's line to its reminders, by the Storyteller's "Reminder lines" choice (Trevor,
			 2026-10-29); none for loose reminders, or while one is dragged. -->
		{#if !looseMode && remDrag.drag === undefined}<ReminderTethers
				seats={seats.map((seat, i) => ({
					at: shown[i],
					spots: fan[i] ?? [],
					held: heldSeat === seat.seatId
				}))}
				board={boardSize}
				{size}
				{chip}
				mode={boardLooks.current.reminderLines}
			/>{/if}

		{#each seats as seat, i (seat.seatId)}
			{@const at = shown[i]}
			<div
				class="slot"
				class:dragging={seatArr.drag?.seatId === seat.seatId}
				class:front={seatArr.front === seat.seatId}
				style:left="{at.x}%"
				style:top="{at.y}%"
				onpointerdown={(event) => seatArr.dragStart(event, seat.seatId, at)}
				onpointermove={(event) => seatArr.dragMove(event)}
				onpointerup={(event) => seatArr.dragEnd(event)}
				onpointercancel={() => seatArr.dragCancel()}
				onkeydown={(event) => seatArr.nudge(event, seat.seatId, at)}
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
					orphan={isOrphan(seat, game.script, characters, offScriptOk)}
					nominations={seatNominationMarks(seat)}
					tokenFreeVotes={votesWithoutToken(game, seat.seatId, characters)}
					dropTarget={seatArr.reorderTarget === seat.seatId ||
						(remDrag.drag !== undefined &&
							remDrag.drag.target === seat.seatId &&
							remDrag.drag.from !== seat.seatId) ||
						hints.tray.target === seat.seatId}
					dragFrom={remDrag.drag !== undefined && remDrag.drag.from === seat.seatId}
					misfit={hints.misfits.has(seat.seatId)}
					role={hints.role(seat.seatId)}
					onTap={(part) =>
						!seatArr.arranging &&
						(part === 'avatar'
							? openProfile(seat.seatId)
							: watching
								? readCharacter(seat.characterId)
								: part === 'note'
									? editNote(seat.seatId)
									: part === 'nominate'
										? askNomination(seat.seatId)
										: openSeat(seat.seatId))}
					onHold={seatArr.arranging || watching
						? undefined
						: (on) => on && seatArr.held(seat.seatId)}
					onGhostVote={() =>
						!seatArr.arranging &&
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
					{@const dragged = remDrag.drag?.reminderId === reminder.reminderId}
					{@const spot =
						boardLooks.current.reminders === 'free'
							? grimoire.reminderSpots[reminder.reminderId]
							: undefined}
					<BoardReminderChip
						{reminder}
						at={dragged ? remDrag.drag!.at : (spot ?? at[k])}
						character={characters.get(reminder.characterId)}
						alignment={placingAlignment(game, reminder, characters)}
						art={artOf(reminder)}
						size={chip}
						disabled={seatArr.arranging || watching}
						seatNumber={i + 1}
						onHeldSeat={heldSeat === seat.seatId}
						dragging={dragged}
						extra={hints.extras.has(reminder.reminderId)}
						now={nw.isStepReminder(reminder)}
						onTap={() => openReminder(seat.seatId, reminder.reminderId)}
						onDrag={(x, y, end) => remDrag.move(reminder.reminderId, seat.seatId, x, y, end)}
						onCancel={() => remDrag.cancel()}
					/>
				{/each}
			{/if}
		{/each}

		<!-- Reminders that belong to no one, where they were put down (Trevor, 2026-10-17). -->
		{#each looseReminders(game) as reminder, k (reminder.reminderId)}
			{@const dragged = remDrag.drag?.reminderId === reminder.reminderId}
			<BoardReminderChip
				{reminder}
				at={dragged
					? remDrag.drag!.at
					: (grimoire.reminderSpots[reminder.reminderId] ?? { x: 12 + 8 * (k % 4), y: 80 })}
				character={characters.get(reminder.characterId)}
				alignment={placingAlignment(game, reminder, characters)}
				art={artOf(reminder)}
				size={chip}
				disabled={seatArr.arranging || watching}
				loose
				dragging={dragged}
				extra={hints.extras.has(reminder.reminderId)}
				unassigned={!looseMode}
				now={nw.isStepReminder(reminder)}
				onTap={() => heldDialog?.show(reminder.reminderId)}
				onDrag={(x, y, end) => remDrag.move(reminder.reminderId, undefined, x, y, end)}
				onCancel={() => remDrag.cancel()}
			/>
		{/each}
		<!-- A Fabled or Loric's reminder follows the finger while it is dragged. -->
		{#if heldDrag}
			<BoardReminderChip
				reminder={heldDrag}
				at={remDrag.drag!.at}
				character={characters.get(heldDrag.characterId)}
				art={artOf(heldDrag)}
				size={chip}
				disabled
				dragging
				ghost
				onTap={() => {}}
			/>
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
		{#if nw.walk && !ended}
			<NightStrip
				{grimoire}
				steps={nw.steps}
				night={nw.walk.night}
				index={nw.walk.index}
				onIndex={(index) => nw.walk && (nw.walk = { ...nw.walk, index })}
				onPastEnd={() => flow.endHint++}
				asleepBy={nw.asleepRule}
				emptySeatBy={nw.emptySeatRule}
				attack={nw.attack}
				onOpen={(step) => {
					if (!nw.walk) return;
					nw.guided = { step, night: nw.walk.night };
					nw.guideOpen = true;
				}}
				onClose={() => (nw.walk = undefined)}
			/>
		{/if}
		{#if ended}
			<HistoryStrip {grimoire} />
		{:else}
			<ReminderBank
				{grimoire}
				{board}
				size={chip}
				focus={nw.walk && nw.step?.character
					? stepReminders(nw.step.character.id, nw.walk.night, nw.step.character)
					: undefined}
				focusMode={stepFocus.current.mode}
				seatAt={remDrag.seatAt}
				spotAllowed={remDrag.spotAllowed}
				ruleAt={remDrag.ruleAt}
				dropping={remDrag.drag !== undefined}
				dropOver={!!remDrag.drag?.overNew}
				onRule={(reminder, characterId, tokenId) =>
					moveConfirm?.requestRule(reminder, characterId, tokenId)}
				onHints={(h) => (hints.tray = h)}
				run={flow.run}
				disabled={watching}
			/>
		{/if}

		<!-- Measures the tap target, the height every reminder takes on the board. -->
		<span class="tap-probe" aria-hidden="true" bind:clientHeight={tapPx}></span>
		{#if boardLooks.current.rulesAt !== 'middle' && game.ruleCharacters.length > 0}
			<div class="rules-edge" bind:clientWidth={edgeW} bind:clientHeight={edgeH}>
				{@render ruleTokens(Math.max(tapPx, Math.round(size * 0.5)))}
			</div>
		{/if}
		<BoardCorner
			{game}
			{watching}
			corner={cornerInfo}
			gamePhase={phase}
			fitRoom={fitCorner}
			{width}
			{rootFont}
			{startedAt}
			endedAt={ended?.endedAt}
			onEdit={editGameInfo}
			onShare={() => (phonesOpen = true)}
			bind:titleW
			bind:titleH
			bind:room={corner}
		>
			{#snippet status()}
				{#if ended}
					<!-- Above Game info (the corner), out of History's strip so the strip keeps
					     its room for the change shown (Trevor, 2026-10-25); held off the corner's
					     size, so ending the game moves nothing. Tapping it offers to reopen. -->
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
				{/if}
			{/snippet}
		</BoardCorner>
		<!-- A spectator is reminded the whole time they watch (Trevor, 2026-10-28). -->
		{#if watching}<div class="fair-play"><FairPlayNotice kind="secret" short /></div>{/if}
		<!-- The day timer on the board too (Trevor, 2026-10-17); one timer for the app. The
		     soundboard beside it (Trevor, 2026-10-27: "Sound can be next to timer for now"), the
		     Storyteller's only. -->
		<div class="board-timer" bind:clientWidth={timerW} bind:clientHeight={timerH}>
			{#if !watching}
				<IconButton
					icon="soundboard"
					label={t('settings.soundboard')}
					outlined
					onclick={() => (soundboardOpen = true)}
				/>
			{/if}
			<!-- Once the game ends the timer keeps its room, unseen, so no seat moves. -->
			<div class="timer-slot" class:gone={!showTimer} inert={!showTimer}>
				<DayTimer
					alive={livingByTeam(game).alive}
					variant="compact"
					readOnly={watching || !showTimer}
					shown={watchedTimer}
				/>
			</div>
		</div>
		<div class="centre" bind:clientWidth={centreW} bind:clientHeight={centreH}>
			<!-- Until the game is set up: choosing characters and the bag, then out of the way. -->
			{#if boardLooks.current.rulesAt === 'middle'}
				{@render ruleTokens(Math.round(size * 0.8))}
			{/if}
		</div>
	</div>
</div>

<!-- Day and night sound (plan U3), for the Storyteller's own board only. -->
<BoardAmbience scene={watching || ended || phaseNow.kind === 'setup' ? null : phaseNow.kind} />
{#if !watching}
	<!-- Sounds for the Storyteller's actions (plan U7). -->
	<BoardActionSounds
		now={{
			phase: phaseNow.kind,
			executions: game.today.entries.filter((entry) => entry.kind === 'execution').length,
			ended: !!ended
		}}
	/>
	<SoundboardDialog bind:open={soundboardOpen} />
{/if}

<!-- Less frequent actions, in an overlay so the toolbar fits a phone. -->
<BoardMenu
	bind:open={menuOpen}
	{watching}
	gameInfo={cornerHidden}
	ended={!!ended}
	onHistory={() => (historyOpen = true)}
	onBluffs={() => (bluffsOpen = true)}
	onNotes={() => (notesOpen = true)}
	onCallTown={!watching && !ended && roomHost().code ? () => (callTownOpen = true) : undefined}
	onGameInfo={() => (modeMenuOpen = true)}
	onCharacterSelection={startedAt === undefined && !setUp && !watching
		? () => goto(resolve('/grimoire/[gameId]/setup', { gameId: game.gameId }))
		: undefined}
	onAddSeat={() =>
		// The seat just appears; tap it to choose a character or Traveller (Trevor, 2026-10-16).
		startPlacing((position) => void grimoire.addSeat(position))}
	onAddRule={() => rules?.add()}
	onArrange={() => seatArr.start()}
	onExport={() => (exportOpen = true)}
	onFeedback={watching ? undefined : () => (feedbackOpen = true)}
	onReopen={() => (reopenOpen = true)}
	onNewGame={watching ? undefined : () => newGameSheet?.begin()}
	onCloseRoom={!watching && roomHost().code ? () => roomHost().close() : undefined}
	onEnd={() => (endOpen = true)}
/>
{#if !watching}<NewGameSheet
		bind:this={newGameSheet}
		{game}
		started={startedAt !== undefined}
		ended={!!ended}
	/>{/if}

<ModeMenu
	{game}
	bind:open={modeMenuOpen}
	onEdit={watching ? undefined : editGameInfo}
	{startedAt}
	endedAt={ended?.endedAt}
	{phase}
	{watcherCount}
	onShare={watching ? undefined : () => (phonesOpen = true)}
/>
<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />
<HeldReminderDialog
	bind:this={heldDialog}
	{grimoire}
	onRemove={(id) => moveConfirm?.requestReturn(id)}
	onMove={(id, to) => moveConfirm?.request(id, to)}
/>
<AlignmentAsk {grimoire} />
<StarPassPrompt {grimoire} active={!ended && !grimoire.open.viewOnly} />
<FirstDeathAsk {grimoire} />
<NominationAsk {grimoire} bind:asks={nominationAsks} />
<EndGameDialogs
	{grimoire}
	{ended}
	{endedText}
	bind:endOpen
	bind:reopenOpen
	onChange={() => (endedRead += 1)}
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

<ReminderAsk {grimoire} />

<PhaseDialogs {flow} {game} {characters} />

<LeaveGuard {game} {watching} />

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
	onNominated={nominated}
	onExecute={(seatId) => flow.executeFromSeat(seatId)}
/>

<SeatProfileDialog bind:open={profileOpen} {game} seatId={profileSeat} />

<!-- The board's nomination marks: who did this player nominate? (Trevor, 2026-10-23) -->
<NominationChooser {grimoire} {characters} bind:asking={nominatingFrom} onNominated={nominated} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

<NotesSheet bind:this={notesSheet} bind:open={notesOpen} {grimoire} />

<ExportGameDialog bind:open={exportOpen} load={exportGame} {capture} />
{#if !watching}
	<GameFeedbackSheet bind:open={feedbackOpen} {game} />
{/if}

<BoardScriptDialog
	bind:open={scriptOpen}
	{game}
	script={loadedScript}
	logo={boardLogo}
	room={watching ? undefined : roomHost().code}
	{characters}
	layout={{ ...layout, aspect }}
	corner={cornerInfo}
	{look}
	picture={watching ? undefined : ownPicture}
	pictureRoom={watching ? grimoire.room : undefined}
	testid="script-scroll"
/>

<CallTownConfirm bind:open={callTownOpen} />

<!-- Over the board, so the Storyteller never leaves the game (Trevor, 2026-10-17). -->
<Dialog bind:open={phonesOpen} title={t('room.title')} size="full" shownToPlayers>
	<RoomPanel game={grimoire.open} />
</Dialog>

{#snippet coverActions()}
	<GrimCoverActions
		{game}
		callTown={!ended && !!roomHost().code}
		script={loadedScript}
		logo={boardLogo}
		room={watching ? undefined : roomHost().code}
		{characters}
		{layout}
		corner={cornerInfo}
		{look}
		picture={watching ? undefined : ownPicture}
		pictureRoom={watching ? grimoire.room : undefined}
	/>
{/snippet}

{#snippet coverTimer()}
	{#if showTimer}<DayTimer alive={livingByTeam(game).alive} variant="compact" />{/if}
{/snippet}

<DaySheet
	bind:open={dayOpen}
	game={grimoire.open}
	cover={coverDetails}
	{coverTimer}
	{coverActions}
	onSoundboard={watching ? undefined : () => (soundboardOpen = true)}
	onEndDay={() => (flow.endDayOpen = true)}
	onSavant={(seatId) => {
		savantSeat = seatId;
		savantOpen = true;
	}}
/>
<SavantSheet bind:open={savantOpen} {grimoire} seatId={savantSeat} />
<ConfirmDialog
	bind:open={savantAskOpen}
	title={t('day.savantAsk')}
	onConfirm={() => (savantOpen = true)}
/>

<GuidedStep
	bind:open={nw.guideOpen}
	{grimoire}
	step={nw.guided?.step}
	night={nw.guided?.night ?? 'first'}
	steps={nw.guidedSteps}
	onStep={(step) => {
		if (!nw.guided) return;
		nw.guided = { step, night: nw.guided.night };
		// The walk-through under the board follows.
		if (nw.walk && nw.walk.night === nw.guided.night) {
			const i = nw.steps.findIndex((s) => s.id === step.id);
			if (i >= 0) nw.walk = { ...nw.walk, index: i };
		}
	}}
	onInfoTokens={(token, filled) => {
		// A card the step's text names opens over the step, which stays open under it.
		if (token && infoSheet) return infoSheet.openWith(token, filled);
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

<RuleCharacters bind:this={rules} {grimoire} {watching} onReminder={(id) => heldDialog?.show(id)} />

<style>
	/* Start game's question: the setup reminders still to place (Trevor, 2026-10-20). */
	.grimoire {
		/* Its own layer, so the backdrop sits behind the toolbar and board, not the page. */
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		/* Fills the screen: a game hides the sidebar (route data). */
		height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
		min-height: calc(20 * var(--u));
	}
	/* Mirrors the corner's script name, bottom right above the reminder bank, with the same
	   halo and no band (Trevor, 2026-10-28). */
	.fair-play {
		position: absolute;
		right: var(--edge-right, var(--space-1));
		bottom: var(--edge-bottom, var(--space-1));
		z-index: 1;
		max-width: 40%;
		text-shadow: 0 0 0.3em var(--surface);
		pointer-events: none;
	}
	.strip-measure {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		/* What .board.walking adds to the bottom margin. */
		height: calc(var(--strip-h) + var(--space-2));
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
	/* A held seat lifts and everything else on the board darkens (Trevor, 2026-10-26). */
	.holding .slot.dragging {
		scale: 1.12;
	}
	.holding .slot:not(.dragging),
	.holding :global(.chip-slot:not(.on-held-seat)),
	.holding :global(.tethers line:not(.held)) {
		opacity: 0.35;
		transition: opacity 0.15s;
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
	/* Dimmed so seats and reminders stay clear over any image. */
	.game-over {
		flex: none;
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
		font-size: 0.9rem;
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
	/* The day timer in the board's top right corner, clear of the seats' ring. */
	.board-timer {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		z-index: 2;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.timer-slot {
		display: flex;
	}
	.timer-slot.gone {
		visibility: hidden;
	}
	/* The soundboard's button has the timer's solid fill, so it reads on any background. */
	.board-timer :global(.icon-button[data-outlined]) {
		background: var(--surface);
	}
	/* Small, in the board's top left corner, clear of the seats' ring. */
	.rules-edge {
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		max-width: 30%;
		z-index: 2;
	}
</style>
