<script lang="ts">
	import { offerScriptToReports } from '#lib/features/reports/report-script.svelte.ts';
	import type { DayMark, NightStep } from '#lib/core/rules/index.ts';
	import GuidedStep from './GuidedStep.svelte';
	import NightStrip from './NightStrip.svelte';
	import HistoryStrip from './HistoryStrip.svelte';
	import { phaseText } from './phase-text.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { boardNightSteps, stepHolders, tonight } from './night-steps.ts';
	import { changedCharacters, diedToday } from '#lib/core/engine/index.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import AlignmentDraw from './AlignmentDraw.svelte';
	import { endedGames, gameStarts, nightUnderway, type EndedGame } from './device-notes.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import GameBackdrop from './GameBackdrop.svelte';
	import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { goto, replaceState } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
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
		dayNumber,
		gamePhase,
		livingByTeam,
		setupComplete,
		diedSinceNewDay,
		onDeathTrigger,
		stepNightNumbers,
		todaysNominations,
		mayNominate,
		votesWithoutToken,
		characterNominationPrompts,
		type CharacterNominationPrompt
	} from '#lib/core/rules/index.ts';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
	import {
		nominationPrompts,
		seatHasAbility,
		type NominationPrompt
	} from '#lib/core/modes/index.ts';
	import DayTimer from '#lib/features/day/DayTimer.svelte';
	import BoardAmbience from '#lib/features/sound/BoardAmbience.svelte';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import { showableBluffSets } from '#lib/features/bluffs/bluffs.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		followSeating,
		isDefaultLayout,
		isRotation,
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
		cornerObstacles,
		keepClear,
		nameBoxes as boardNameBoxes,
		rimToward,
		toPercent as boardToPercent,
		toPx as boardToPx
	} from './board-geometry.ts';
	import { cornerRoom } from './corner-room.ts';
	import { markBoardShown } from '#lib/ui/board-cover.ts';
	import { fitReminders } from './reminder-fan.ts';
	import { isOrphan, placingAlignment, seatMisses } from './board.ts';
	import { pendingSetup, type TrayItem } from './setup-tray.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { fromScript, scriptLogo, scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import PlayerScriptTabs from '#lib/features/player/PlayerScriptTabs.svelte';
	import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';
	import PlayerScriptActions from '#lib/features/player/PlayerScriptActions.svelte';
	import PlayerGrim from '#lib/features/player/PlayerGrim.svelte';
	import PlayerNotes from '#lib/features/player/PlayerNotes.svelte';
	import { scriptShareable } from '#lib/features/scripts/share-codes.ts';
	import { currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { scriptKey } from '#lib/features/player/notebook.ts';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import {
		dealtSeats,
		playersLine,
		standardPlayersLine
	} from '#lib/features/modes/players-line.ts';
	import { savedChoiceFor } from '#lib/features/modes/script-choices.svelte.ts';
	import {
		publicTravellerTest,
		travellersInPlay
	} from '#lib/features/player/travellers-in-play.ts';
	import { publicProjection } from '#lib/core/sync/public-projection.ts';
	import HistoryDialog from './HistoryDialog.svelte';
	import DaySheet from '#lib/features/day/DaySheet.svelte';
	import ExecutionDialog from '#lib/features/day/ExecutionDialog.svelte';
	import SavantSheet from '#lib/features/savant/SavantSheet.svelte';
	import NotesSheet from './NotesSheet.svelte';
	import { DAY_HASH } from '#lib/features/day/day-hash.ts';
	import SeatSheet from './SeatSheet.svelte';
	import NominationChooser from './NominationChooser.svelte';
	import SeatToken from './SeatToken.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import { stepReminders } from './reminders.ts';
	import { stepFocus } from './step-focus.svelte.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import HeldReminderDialog from './HeldReminderDialog.svelte';
	import BoardCorner from './BoardCorner.svelte';
	import { cornerLines } from './corner-lines.ts';
	import LeaveGuard from './LeaveGuard.svelte';
	import BoardMenu from './BoardMenu.svelte';
	import BoardToolbar from './BoardToolbar.svelte';
	import RuleCharacters from './RuleCharacters.svelte';
	import type { GameInfoChanges } from '#lib/features/modes/GameInfoEditDialog.svelte';
	import ModeMenu from '#lib/features/modes/ModeMenu.svelte';
	import NewGameSheet from '#lib/features/modes/NewGameSheet.svelte';
	import { extraReminders, isGeneric, reminderWords } from './reminders.ts';
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
	}

	let { grimoire, watching = false, watchedTimer, over }: Props = $props();
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
		if (!preferences.current.assistance.trackNominations) return undefined;
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
	const boardSize = $derived({ width, height });
	const toPx = (p: SeatPoint) => boardToPx(p, boardSize);
	const toPercent = (p: { x: number; y: number }): SeatPoint => boardToPercent(p, boardSize);
	const nameBoxes = $derived.by(() =>
		boardNameBoxes({
			names: seats.map((seat, i) => seat.playerName ?? `Seat ${i + 1}`),
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
	const fitCorner = (h: number) => cornerRoom(cornerBoxes, { width, height }, h + 4, 4 + 8);
	/** How wide the corner may be now (BoardCorner). */
	let corner = $state(0);
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
	/** The game's special rules, kept whole with the game (game-mode-store.ts). */
	const gameRules = $derived(readGameMode(game.gameId)?.rules ?? []);
	/**
	 * Who has an ability under a special rule, when one changes it (The Phantom Detectives:
	 * the dead keep theirs, living Townsfolk have none).
	 */
	const abilitiesRule = $derived(gameRules.find((r) => r.parts.abilities)?.parts.abilities);
	function wakes(step: NightStep): boolean {
		const holders = stepHolders(game, step, characters);
		const id = step.character?.id;
		return (
			holders.length === 0 ||
			holders.some(
				(s) =>
					seatHasAbility(abilitiesRule, game, s, characters) ||
					(id !== undefined && !!onDeathTrigger(id, characters) && diedTonight.has(s))
			)
		);
	}
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
	/** What a seat's reminders keep off: its name, a dead seat's skull (SeatDisc), its note mark. */
	function avoidFor(i: number): Box[] {
		return avoidBoxes({
			centre: toPx(shown[i]),
			size,
			hasFace: seats[i]?.characterId !== undefined,
			name: nameBoxes[i]?.box,
			dead: !!seats[i]?.dead,
			note: !!seats[i]?.note,
			nameOffset: boardLooks.current.nameOffset
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
	let timerW = $state(0);
	let titleW = $state(0);
	let titleH = $state(0);
	let timerH = $state(0);
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
				timer: showTimer ? { w: timerW, h: timerH } : undefined,
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
	const heldLabel = (name: string) => `${name}'s reminders`;
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
			game.seating.filter(
				(id) => seatMisses(game, reminder, id, characters, grimoire.atDawn).length > 0
			)
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
		if (id === undefined) return nw.holders;
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
			(id) => game.seats[id].characterId === 'savant' && !game.seats[id].dead
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

	let endNightOpen = $state(false);
	let endDayOpen = $state(false);
	/**
	 * End day, from the bank or the day view (Trevor, 2026-10-18): the day's timer stops and
	 * Dusk is ticked, which runs the rules checked at dusk (GameEndPrompt); the walk-through
	 * starts on the board, where it is on.
	 */
	function endDay(): void {
		dayOpen = false;
		if (liveDayTimer.running) liveDayTimer.toggle();
		grimoire.beginNight();
		const night = tonight(game);
		if (!grimoire.isNightStepDone(night, { id: 'dusk' }))
			grimoire.toggleNightStep(night, { id: 'dusk' });
		if (preferences.current.assistance.nightWalkthrough) nw.run(true);
	}
	/**
	 * Execution ends the day (Trevor, 2026-10-22): the player chosen is executed first, unless
	 * that execution is already logged, so the rules checked at dusk see it.
	 */
	/** A seat's status chose Executed: during the day, the day's Execution asks with them chosen. */
	let executeChosen = $state<SeatId>();
	$effect(() => {
		if (!endDayOpen) executeChosen = undefined;
	});
	function executeFromSeat(seatId: SeatId): boolean {
		if (bankRun.label !== t('day.execution') || bankRun.disabled) return false;
		sheetOpen = false;
		executeChosen = seatId;
		endDayOpen = true;
		return true;
	}
	function executeAndEndDay(
		seatId: SeatId | undefined,
		save: CharacterId | 'dies' | undefined,
		marks: Partial<Record<DayMark, boolean>>,
		keepGoing: boolean
	): void {
		for (const [mark, value] of Object.entries(marks) as [DayMark, boolean][])
			grimoire.run({ type: 'SetDayMark', mark, value });
		const logged = game.today.entries.some((e) => e.kind === 'execution' && e.seatId === seatId);
		if (seatId && !logged)
			grimoire.run({
				type: 'Execute',
				seatId,
				...(save === 'dies' ? { dies: true } : save ? { savedBy: save } : {})
			});
		// Keep the day going (Trevor, 2026-10-26): a player may still nominate after it.
		if (!keepGoing) endDay();
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
		gameStarts.start(game.gameId);
		startedRead += 1;
		if (preferences.current.assistance.nightWalkthrough) nw.run();
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
		if (nw.nightOn)
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
				disabled: !nw.canRun,
				onclick: () => nw.run()
			};
		// Set up stands in for Start game only: once a night or day is under way, the bank
		// ends it, characters or not.
		if (game.pastDays.length === 0 && showSetup)
			return {
				label: 'Set up',
				text: 'Set up',
				icon: 'bag' as const,
				disabled: seatArr.arranging || !!placing,
				onclick: openSetup
			};
		if (game.pastDays.length === 0)
			return {
				label: 'Start game',
				text: 'Start game',
				icon: 'night' as const,
				disabled: !nw.canRun,
				onclick: startGame
			};
		// Execution in place of End day (Trevor, 2026-10-22): ending a day asks who was executed.
		return {
			label: t('day.execution'),
			text: t('day.execution'),
			icon: 'night' as const,
			disabled: !!ended || grimoire.open.viewOnly || seatArr.arranging || !!placing,
			onclick: () => {
				endDayOpen = true;
			}
		};
	});

	function endNight() {
		if (!grimoire.endNight()) return;
		nw.walk = undefined;
		// Into the day, or stay on the grimoire (Trevor, 2026-10-18: a Storyteller setting).
		if (preferences.current.assistance.dayAfterNight) dayOpen = true;
		offerSavant();
	}

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
	// Reopening puts it back in Resume game.
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
	// ── The players' copy of the script ──
	let scriptOpen = $state(false);
	const loadedScript = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	// A report sent from the board carries the game's script, never the game (Trevor, 2026-10-22).
	offerScriptToReports(() => loadedScript);
	const boardLogo = $derived(loadedScript && scriptLogo(loadedScript));
	/** Share links to the saved script when it is the game's, as /play's does (parity). */
	const scriptShare = $derived.by(() => {
		if (!scriptOpen || !loadedScript) return undefined;
		const json = (s: LoadedScript) => JSON.stringify(scriptToJson(s));
		const current = currentScript.current;
		const same = current && json(current) === json(loadedScript);
		return scriptShareable(loadedScript, same ? currentScript.saved : undefined);
	});
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
	/** When Start game was tapped, for Game time in the corner; read again when it is. */
	let startedRead = $state(0);
	const startedAt = $derived((void startedRead, gameStarts.read(game.gameId)));
	/**
	 * The night or day in play, for the corner (Trevor, 2026-10-23): Setup until Start game,
	 * then Night 1, and a night from End day (Dusk) until its Dawn starts the next day. A game
	 * with days played is past Setup even where this device has no start time (gamePhase).
	 */
	const phaseNow = $derived(
		gamePhase(game.pastDays.length, {
			begun: startedAt !== undefined,
			nightUnderway: ended
				? nightUnderway(
						{ day: grimoire.nightDay, done: grimoire.nightDone },
						game.pastDays.length,
						true
					)
				: grimoire.nightRunning || grimoire.nightUnderway
		})
	);
	const phase = $derived(phaseText(phaseNow));
	/** The corner's lines, which the room's phones show too (Trevor, 2026-10-24). */
	const cornerInfo = $derived(
		cornerLines({
			gameId: game.gameId,
			phase: phaseNow,
			startedAt,
			endedAt: ended?.endedAt,
			watchers: watcherCount,
			watching,
			version: scriptVersion(undefined, game.script.meta) ?? savedChoiceFor(game.script)?.version,
			players: playersLine(game, characters)
		})
	);
	// Phones get the table's standard split, never the grimoire's: a Baron's extra Outsiders
	// are the Storyteller's to know (https://wiki.bloodontheclocktower.com/Baron).
	$effect(() => {
		if (!watching)
			roomHost().showCorner(game.gameId, {
				...cornerInfo,
				...(cornerInfo.players ? { players: standardPlayersLine(game.seating.length) } : {})
			});
	});
	// Players see where the game is up to, and the day timer during the day (Trevor, 2026-10-26).
	$effect(() => {
		if (!watching) roomHost().showPhase(game.gameId, ended ? undefined : phaseNow);
	});
	// Always shown, unless the script itself asks not to (Trevor, 2026-10-23: "always show
	// script name and author on board, remove as an option").
	const showTitle = $derived(!game.script.meta?.hideTitle);
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

	// ── Fabled and Loric: their dialogs (RuleCharacters) ──
	let rules = $state<ReturnType<typeof RuleCharacters>>();
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
			onclick={() => rules?.showAll()}
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
			() => rules?.showAll()
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
			<span class:lifted={remDrag.drag?.reminderId === last.reminderId}>
				<BoardReminder
					label={reminderWords(last)}
					infinite={isGeneric(last)}
					symbol={last.symbol}
					symbolColour={last.symbolColour}
					symbolFill={last.symbolFill}
					character={characters.get(last.characterId)}
					alignment={placingAlignment(game, last, characters)}
					size={Math.round(chip * 0.7)}
					disabled={seatArr.arranging || watching}
					onTap={() => heldDialog?.show(last.reminderId)}
					onDrag={(x, y, end) => remDrag.move(last.reminderId, undefined, x, y, end)}
					onCancel={() => remDrag.cancel()}
				/>
			</span>
			{#if held.length > 1}
				<span class="held-more">
					<BoardReminder
						label=""
						character={undefined}
						more={held.length - 1}
						size={Math.round(chip * 0.7)}
						disabled={seatArr.arranging || watching}
						onTap={onMore}
					/>
				</span>
			{/if}
		</span>
	{/if}
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
						onclick={() => rules?.show(id)}
					>
						<CharacterToken {character} size={tokenSize} />
					</button>
					<!-- Its reminders, tight to its top right: parked there, out of play (Trevor,
					     2026-10-18). -->
					{@render heldCluster(ruleReminders(game, id), heldLabel(character.name), () =>
						rules?.show(id)
					)}
				</li>
			{/if}
		{/each}
	</ul>
{/snippet}

<div class="grimoire" bind:this={grimoireEl}>
	<!-- The strip's share of the board's height, to size tokens without it (sizingHeight). -->
	<div
		class="strip-measure"
		aria-hidden="true"
		style:--strip-h={STRIP_H}
		bind:clientHeight={stripReserve}
	></div>
	<GameBackdrop {game} logo={boardLogo || undefined} />
	<BoardToolbar
		{grimoire}
		{watching}
		{seatArr}
		placing={!!placing}
		onCancelPlacing={() => (placing = undefined)}
		onDay={() => (dayOpen = true)}
		onInfo={() => (infoOpen = true)}
		onScript={() => (scriptOpen = true)}
		onShare={() => (phonesOpen = true)}
		onMore={() => (menuOpen = true)}
	/>

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
		<!-- The script's logo, faint behind the seats (Trevor, 2026-10-18: his switch and opacity). -->
		{#if boardLooks.current.logo && boardLogo}
			<ScriptLogo
				src={boardLogo}
				class="board-logo"
				--logo-opacity={boardLooks.current.logoOpacity}
				--logo-h={sizingHeight > 0 ? `${Math.round(0.42 * sizingHeight)}px` : undefined}
			/>
		{/if}
		<!--
			A thin line from each seat to its reminders (Trevor, 2026-10-22: reminders keep to
			their seat's line, with a line back when they have to sit further out), so whose a
			reminder is reads at a glance on a crowded board. First on the board, so every token,
			name, ghost vote and mark draws over them (Trevor, 2026-10-24); only the logo and the
			background are under them.
		-->
		<svg class="tethers" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			{#each seats as seat, i (seat.seatId)}
				{#if !looseMode && remDrag.drag === undefined}
					{#each fan[i] ?? [] as p, k (k)}
						{@const from = rimToward(shown[i], p, boardSize, size)}
						<line
							x1={from.x}
							y1={from.y}
							x2={p.x}
							y2={p.y}
							data-tether={i + 1}
							vector-effect="non-scaling-stroke"
						/>
					{/each}
				{/if}
			{/each}
		</svg>

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
						trayHints.target === seat.seatId}
					dragFrom={remDrag.drag !== undefined && remDrag.drag.from === seat.seatId}
					misfit={misfits.has(seat.seatId)}
					role={seatRole(seat.seatId)}
					onTap={(part) =>
						!seatArr.arranging &&
						(watching
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
					{@const p = dragged ? remDrag.drag!.at : (spot ?? at[k])}
					<div
						class="chip-slot"
						data-seat={i + 1}
						class:on-held-seat={heldSeat === seat.seatId}
						class:dragging={dragged}
						class:extra={extras.has(reminder.reminderId)}
						data-extra={extras.has(reminder.reminderId) ? '' : undefined}
						class:now={nw.isStepReminder(reminder)}
						style:left="{p.x}%"
						style:top="{p.y}%"
					>
						<BoardReminder
							label={reminderWords(reminder)}
							infinite={isGeneric(reminder)}
							symbol={reminder.symbol}
							symbolColour={reminder.symbolColour}
							symbolFill={reminder.symbolFill}
							character={characters.get(reminder.characterId)}
							alignment={placingAlignment(game, reminder, characters)}
							size={chip}
							disabled={seatArr.arranging || watching}
							onTap={() => openReminder(seat.seatId, reminder.reminderId)}
							onDrag={(x, y, end) => remDrag.move(reminder.reminderId, seat.seatId, x, y, end)}
							onCancel={() => remDrag.cancel()}
						/>
					</div>
				{/each}
			{/if}
		{/each}

		<!-- Reminders that belong to no one, where they were put down (Trevor, 2026-10-17). -->
		{#each looseReminders(game) as reminder, k (reminder.reminderId)}
			{@const dragged = remDrag.drag?.reminderId === reminder.reminderId}
			{@const p = dragged
				? remDrag.drag!.at
				: (grimoire.reminderSpots[reminder.reminderId] ?? { x: 12 + 8 * (k % 4), y: 80 })}
			<div
				class="chip-slot"
				data-loose
				class:dragging={dragged}
				class:extra={extras.has(reminder.reminderId)}
				data-extra={extras.has(reminder.reminderId) ? '' : undefined}
				class:unassigned={!looseMode}
				data-unassigned={looseMode ? undefined : ''}
				class:now={nw.isStepReminder(reminder)}
				style:left="{p.x}%"
				style:top="{p.y}%"
			>
				<BoardReminder
					label={reminderWords(reminder)}
					infinite={isGeneric(reminder)}
					symbol={reminder.symbol}
					symbolColour={reminder.symbolColour}
					symbolFill={reminder.symbolFill}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder, characters)}
					size={chip}
					disabled={seatArr.arranging || watching}
					onTap={() => heldDialog?.show(reminder.reminderId)}
					onDrag={(x, y, end) => remDrag.move(reminder.reminderId, undefined, x, y, end)}
					onCancel={() => remDrag.cancel()}
				/>
			</div>
		{/each}
		<!-- A Fabled or Loric's reminder follows the finger while it is dragged. -->
		{#if heldDrag}
			<div
				class="chip-slot dragging"
				style:left="{remDrag.drag!.at.x}%"
				style:top="{remDrag.drag!.at.y}%"
				aria-hidden="true"
			>
				<BoardReminder
					label={reminderWords(heldDrag)}
					infinite={isGeneric(heldDrag)}
					symbol={heldDrag.symbol}
					symbolColour={heldDrag.symbolColour}
					symbolFill={heldDrag.symbolFill}
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
		{#if nw.walk && !ended}
			<NightStrip
				{grimoire}
				steps={nw.steps}
				night={nw.walk.night}
				index={nw.walk.index}
				onIndex={(index) => nw.walk && (nw.walk = { ...nw.walk, index })}
				onPastEnd={() => endHint++}
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
				onRule={(reminder, characterId, tokenId) =>
					moveConfirm?.requestRule(reminder, characterId, tokenId)}
				onHints={(h) => (trayHints = h)}
				run={bankRun}
				disabled={watching}
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

<!-- Day and night sound (plan U3), for the Storyteller's own board only. -->
<BoardAmbience scene={watching || ended || phaseNow.kind === 'setup' ? null : phaseNow.kind} />

<!-- Less frequent actions, in an overlay so the toolbar fits a phone. -->
<BoardMenu
	bind:open={menuOpen}
	gameInfo={cornerHidden}
	ended={!!ended}
	onHistory={() => (historyOpen = true)}
	onBluffs={() => (bluffsOpen = true)}
	onNotes={() => (notesOpen = true)}
	onCallTown={!watching && !ended && roomHost().code
		? () => roomHost().callTown() || toast(t('room.callTownFailed'))
		: undefined}
	onGameInfo={() => (modeMenuOpen = true)}
	onCharacterSelection={startedAt === undefined && !watching
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

<!-- The same question as the day view's Execution. -->
<ExecutionDialog
	bind:open={endDayOpen}
	{game}
	characters={grimoire.open.characters}
	chosen={executeChosen}
	onConfirm={executeAndEndDay}
/>

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
	onExecute={executeFromSeat}
/>

<!-- The board's nomination marks: who did this player nominate? (Trevor, 2026-10-23) -->
<NominationChooser {grimoire} {characters} bind:asking={nominatingFrom} onNominated={nominated} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

<NotesSheet bind:this={notesSheet} bind:open={notesOpen} {grimoire} />

<ExportGameDialog bind:open={exportOpen} load={exportGame} {capture} />
{#if !watching}
	<GameFeedbackSheet bind:open={feedbackOpen} {game} />
{/if}

<!-- Exactly what players see on /play (Trevor, 2026-10-19): byline, Print, Share and tabs. -->
<Dialog bind:open={scriptOpen} title={game.script.meta?.name || 'Script'} size="max">
	{#snippet headActions()}
		<PlayerScriptActions
			script={loadedScript}
			version={scriptVersion(undefined, loadedScript?.meta)}
			share={scriptShare}
			room={watching ? undefined : roomHost().code}
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
			{@const town = publicProjection(
				game,
				publicTravellerTest(game.gameId, characters),
				layout,
				cornerInfo,
				characters
			)}
			<!-- Every screen a player has, Grim and Notes too (Trevor, 2026-10-23: "feature
			     parity"): the town as the table knows it, and the Storyteller's own notes. -->
			<PlayerScriptTabs
				script={loadedScript}
				players={dealtSeats(town.seats).dealt}
				inPlay={charactersInPlay(game)}
				travellers={travellersInPlay(town.seats)}
				rules={gameSheetRules(game.gameId)}
			>
				{#snippet grim()}<PlayerGrim
						script={loadedScript!}
						town={{
							seats: town.seats,
							layout: town.layout,
							storytellerName: town.storytellerName,
							corner: town.corner,
							gameId: game.gameId,
							guessKey: `storyteller:${game.gameId}`
						}}
					/>{/snippet}
				{#snippet notes()}<PlayerNotes
						notesKey={scriptKey(loadedScript!)}
						town={{ seats: town.seats, guessKey: `storyteller:${game.gameId}` }}
					/>{/snippet}
			</PlayerScriptTabs>
		{/if}
	</div>
</Dialog>

<!-- Over the board, so the Storyteller never leaves the game (Trevor, 2026-10-17). -->
<Dialog bind:open={phonesOpen} title={t('room.title')} size="full" shownToPlayers>
	<RoomPanel game={grimoire.open} />
</Dialog>

<DaySheet
	bind:open={dayOpen}
	game={grimoire.open}
	onEndDay={() => (endDayOpen = true)}
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
		/* Fills the screen: a game hides the sidebar (route data). */
		height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
		min-height: calc(20 * var(--u));
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
	.holding .chip-slot:not(.on-held-seat),
	.holding .tethers {
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
	.tethers {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.tethers line {
		stroke: var(--on-surface);
		stroke-opacity: 0.35;
		stroke-width: 1.5;
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
	/* The walked-through step's reminders already on the board: the bank's highlight, a ring,
	   glow or both (Settings > Tokens). */
	.chip-slot.now > :global(.reminder) {
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
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
	/* Centred on the board's playable area (Trevor, 2026-10-18), inside the seat ring: at most
	   42% of the board's width and height, the logo keeping its shape within; under the seats. */
	.board :global(.board-logo) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 42%;
		/* The board's height without the walk-through strip (sizingHeight), so the logo keeps
		   its size when the night starts (Trevor, 2026-10-23: "flexes for a second"). */
		height: var(--logo-h, 42%);
		translate: -50% -50%;
		opacity: var(--logo-opacity);
		pointer-events: none;
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
	.rule {
		/* Sized from the seats, which already follow the token size setting. */
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
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
