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
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
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
	import LateSeatOnBoard from '#lib/features/late-player/LateSeatOnBoard.svelte';
	import { resolve } from '$app/paths';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		boardRuleCount,
		charactersInPlay,
		scriptCharacterIds,
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
		characterNominationPrompts,
		dayClaim,
		type CharacterNominationPrompt
	} from '#lib/core/rules/index.ts';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
	import { nominationPrompts, type NominationPrompt } from '#lib/core/modes/index.ts';
	import DayTimer from '#lib/features/day/DayTimer.svelte';
	import BoardActionSounds from '#lib/features/sound/BoardActionSounds.svelte';
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
		boardAspect
	} from '#lib/ui/seating/seat-layout.ts';
	import { rememberBoard } from '#lib/ui/seating/last-board.svelte.ts';
	import { SeatArranging } from './seat-arranging.svelte.ts';
	import SeatingBar from './SeatingBar.svelte';
	import { enterSeating, seatingRequested } from './seating-mode.svelte.ts';
	import { BoardSizing, type BoardSizingContext } from './board-sizing.svelte.ts';
	import { ReminderDragging } from './reminder-drag.svelte.ts';
	import { markBoardShown } from '#lib/ui/board-cover.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { PublicLook } from '#lib/core/sync/public-projection.ts';
	import { drawnLook } from './shared-look.ts';
	import HistoryDialog from './HistoryDialog.svelte';
	import DaySheet from '#lib/features/day/DaySheet.svelte';
	import BoardScriptDialog from './BoardScriptDialog.svelte';
	import BoardSeats from './BoardSeats.svelte';
	import BoardRules from './BoardRules.svelte';
	import CoverButton from '#lib/features/show/CoverButton.svelte';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import type { CoverDetails } from '#lib/features/show/CoverScreen.svelte';
	import SavantSheet from '#lib/features/savant/SavantSheet.svelte';
	import AidMenu from '#lib/features/settings/AidMenu.svelte';
	import { playersDialog } from '#lib/features/room/players-dialog.svelte.ts';
	import { travellersForNewSeat } from '#lib/features/room/add-seat-travellers.ts';
	import { DAY_HASH } from '#lib/features/day/day-hash.ts';
	import SeatSheet from './SeatSheet.svelte';
	import SeatProfileDialog from './SeatProfileDialog.svelte';
	import NominationChooser from './NominationChooser.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import { stepReminders } from './reminders.ts';
	import { stepFocus } from './step-focus.svelte.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import BankReminderDialog from './BankReminderDialog.svelte';
	import { ReminderHand } from './reminder-hand.svelte.ts';
	import BoardCorner from './BoardCorner.svelte';
	import GameNotesToken from './GameNotesToken.svelte';
	import LeaveGuard from './LeaveGuard.svelte';
	import BoardMenu from './BoardMenu.svelte';
	import BoardToolbar from './BoardToolbar.svelte';
	import RuleCharacters from './RuleCharacters.svelte';
	import { storytellerName } from '#lib/features/game/storyteller-name.svelte.ts';
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
	import ExplosionAsk from './ExplosionAsk.svelte';
	import ReincarnateAsk from './ReincarnateAsk.svelte';
	import ReminderAsk from './ReminderAsk.svelte';
	import { NightWalk, type NightWalkContext } from './night-walk.svelte.ts';
	import { PhaseFlow } from './phase-flow.svelte.ts';
	import { SeatHints } from './seat-hints.svelte.ts';
	import GrimCoverActions from './GrimCoverActions.svelte';
	import type { BoardPlayerSource } from './board-player-source.ts';
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

	let board = $state<HTMLElement>();
	// ── Where everything sits on the board (board-sizing.svelte.ts) ──
	const root = watchRootFont();
	const rootFont = $derived(root.current);
	const sizing: BoardSizing = new BoardSizing((): BoardSizingContext => ({
		game,
		characters,
		layout,
		spacedFor: watching ? grimoire.aspect : undefined,
		// Shown to a player, the board looks as it does with the night closed (Trevor, 2026-10-30).
		walking: !!nw.walk && !showingGrim,
		offScriptOk,
		nominations: nominatedToday !== undefined,
		shown: () => shown,
		drag: seatArr.drag,
		rootFont
	}));
	const width = $derived(sizing.width);
	const height = $derived(sizing.height);
	const size = $derived(sizing.size);
	const chip = $derived(sizing.chip);
	const points = $derived(sizing.points);
	const boardSize = $derived(sizing.board);
	const fan = $derived(sizing.fan);
	// Measured on the next frame rather than with bind:clientWidth, so resizing the tokens
	// never re-enters the ResizeObserver callback (a "ResizeObserver loop" error).
	$effect(() => {
		if (!board) return;
		let frame = 0;
		const observer = new ResizeObserver(([entry]) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				sizing.width = entry.contentRect.width;
				sizing.height = entry.contentRect.height;
			});
		});
		observer.observe(board);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	const layout = $derived(grimoire.layout);
	// Who nominated and who was nominated today, for the marks on the seats (Track nominations).
	/**
	 * A seat's nomination marks (Trevor, 2026-10-23): on every player, greyed until they
	 * happen, as the ghost vote shows on the dead. The dead may still be nominated but not
	 * nominate (Trevor, 2026-10-24), so they show only the gavel, unless their character may
	 * (`mayNominate`) or they nominated before they died.
	 */
	function seatNominationMarks(seatId: SeatId) {
		if (!nominatedToday) return undefined;
		const made = nominatedToday.made.has(seatId);
		const received = nominatedToday.received.has(seatId);
		const nominates = made || mayNominate(game, seatId, characters);
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
	// The Token size preview in Settings draws at this board's size.
	$effect(() => rememberBoard({ width, height, seating: game.seating, layout }));
	// Every shared grim keeps each seat at this board's place round the ring (Trevor, 2026-10-27).
	const aspect = $derived(boardAspect({ width, height }));
	$effect(() => {
		if (!watching) roomHost().showAspect(game.gameId, aspect);
	});

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

	// ── Dragging reminders (reminder-drag.svelte.ts) ──
	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	/** The token in hand, from the bank or the board (Trevor, 2026-10-30). */
	const hand = new ReminderHand();
	let bank = $state<ReturnType<typeof ReminderBank>>();
	const remDrag = new ReminderDragging(() => ({
		grimoire,
		game,
		characters,
		points,
		size,
		board: boardSize,
		element: board,
		confirm: moveConfirm
	}));
	const dragOrigin = $derived(remDrag.origin);
	const heldDrag = $derived(remDrag.held);

	// ── Arranging seats (seat-arranging.svelte.ts) ──
	const seatArr: SeatArranging = new SeatArranging(() => ({
		grimoire,
		seating: game.seating,
		layout,
		points,
		size,
		board: boardSize,
		element: board
	}));
	const shown = $derived(seatArr.shown);
	onMount(() => {
		if (seatingRequested(game.gameId)) enterSeating(seatArr); // From Character selection.
	});
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

	// ── Notes: the game's and every player's, on Players (Trevor, 2026-10-29) ──
	let soundboardOpen = $state(false);
	/**
	 * A seat's pen mark opens that player's sheet on Players, with their notes. After the tap's
	 * click, so it doesn't land in the field.
	 */
	function editNote(seatId: SeatId) {
		setTimeout(() => playersDialog.showSeat(seatId));
	}
	/**
	 * A tapped reminder opens only its own dialog, not its seat's sheet (Trevor, 2026-10-18:
	 * "they chose to open reminder, not character").
	 */
	/** A tap on a seat: its avatar opens the profile, its note and gavel their own asks. */
	function tapSeat(seatId: SeatId, part?: 'note' | 'nominate' | 'avatar') {
		if (part === 'avatar') openProfile(seatId);
		else if (watching) readCharacter(game.seats[seatId]?.characterId);
		else if (part === 'note') editNote(seatId);
		else if (part === 'nominate') askNomination(seatId);
		else openSeat(seatId);
	}
	/**
	 * A token on the board tapped: held, as one from the bank is (Trevor, 2026-10-30), for the
	 * seat (or bank) tapped next. With no bank (the game over), its own dialog instead.
	 */
	function holdReminder(reminderId: ReminderId, from?: SeatId) {
		if (bank) hand.toggle({ kind: 'placed', reminderId, from });
		else showReminder(reminderId);
	}
	function showReminder(reminderId: ReminderId) {
		// After the tap's click, so it doesn't land on what opens under the finger.
		setTimeout(() => hand.showAbout({ kind: 'placed', reminderId }));
	}
	// A removed (or undone) seat closes its sheet.
	$effect(() => {
		if (selected !== undefined && !game.seats[selected]) sheetOpen = false;
	});

	// ── Travellers ──
	// ── Placing a new seat: the Storyteller taps where it goes (Trevor, 2026-10-16) ──
	let placing = $state<((position: number) => void) | undefined>();
	/** Seats already placed but not added yet (late players), shown at their spots. */
	let pendingSeats = $state<readonly { position: number; name: string }[]>([]);
	function startPlacing(
		add: (position: number) => void,
		pending: readonly { position: number; name: string }[] = []
	) {
		placing = add;
		pendingSeats = pending;
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
						label: `Place between ${name(i)} and ${name((i + 1) % shown.length)}`,
						pending: pendingSeats.filter((p) => p.position === i + 1).map((p) => p.name)
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
	const hints = new SeatHints(() => ({
		grimoire,
		game,
		characters,
		dragged: dragOrigin?.reminder,
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
		const made = seatNominationMarks(seatId)?.made;
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
	/**
	 * Back to town on the day timer, on the board and in the day (Trevor, 2026-11-01); drawn,
	 * disabled, without a live room, and on a spectator's board.
	 */
	const town = $derived({
		can: !watching && !ended && !!roomHost().code,
		called: roomHost().playersPhase(game.gameId)?.kind === 'town'
	});
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
	/** The board shown to a player who looks at the Grimoire, from their night step. */
	let showingGrim = $state(false);
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
	// One source for the players' screen, whichever way the Storyteller opens it.
	const playerView: BoardPlayerSource = $derived({
		game,
		script: loadedScript,
		logo: boardLogo,
		room: watching ? undefined : roomHost().code,
		characters,
		layout: { ...layout, aspect },
		corner: cornerInfo,
		look,
		picture: watching ? undefined : ownPicture,
		pictureRoom: watching ? grimoire.room : undefined
	});
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
	/**
	 * The game's Storyteller is the Profile's name (Trevor, 2026-10-30: "All connected to
	 * profile name"), kept in step while the game is in play, so a rename in the Profile
	 * reaches the corner, the room and History. A finished game keeps the name it ended with.
	 */
	$effect(() => {
		const name = storytellerName.current;
		if (watching || watchedHistory || ended || name === (game.storytellerName ?? '')) return;
		untrack(() => grimoire.run({ type: 'SetStorytellerName', name }));
	});

	/** The Storyteller's notes on the game; never on a spectator's board. */
	const gameNotes = $derived(watching ? 0 : (game.notes?.length ?? 0));

	// ── Fabled and Loric: their dialogs (RuleCharacters) ──
	let rules = $state<ReturnType<typeof RuleCharacters>>();
</script>

<!-- The Seating mode's bar, in the bank's token row (Trevor, 2026-10-31). -->
{#snippet seatingBar()}<SeatingBar />{/snippet}

{#snippet ruleTokens(tokenSize: number)}
	<BoardRules
		{game}
		{characters}
		{tokenSize}
		{chip}
		disabled={seatArr.arranging || watching}
		lifted={remDrag.drag?.reminderId}
		onShow={(id, kind) => (id ? rules?.show(id) : rules?.showAll(kind))}
		onShowAbility={(via) => rules?.showAbility(via)}
		onHeldTap={(id) => holdReminder(id)}
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
		bind:clientHeight={sizing.stripReserve}
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
		showing={showingGrim}
		onStopShowing={() => {
			showingGrim = false;
			nw.guideOpen = true;
		}}
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
		class:walking={nw.walk !== undefined && !showingGrim}
		class:ended={!!ended}
		class:showing={showingGrim}
		inert={showingGrim}
		style:--tray-h="{chip + 30}px"
		style:--strip-h={nw.walk && !showingGrim ? STRIP_H : undefined}
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
				height={sizing.sizingHeight > 0 ? `${Math.round(0.42 * sizing.sizingHeight)}px` : undefined}
			/>
		{/if}
		<BoardSeats
			{grimoire}
			{shown}
			{fan}
			{size}
			{chip}
			{boardSize}
			{seatArr}
			{remDrag}
			{hints}
			{nw}
			{watching}
			{offScriptOk}
			{nightNumbers}
			nominations={seatNominationMarks}
			{heldSeat}
			{heldDrag}
			{placeSpots}
			onPlace={placeAt}
			onSeat={tapSeat}
			onReminder={(seatId, id) => holdReminder(id, seatId)}
			onLooseReminder={(id) => holdReminder(id)}
		/>
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
				bind:this={bank}
				{hand}
				{grimoire}
				{board}
				size={chip}
				focus={nw.walk && nw.step?.character
					? stepReminders(nw.step.character.id, nw.walk.night, nw.step.character)
					: undefined}
				focusMode={stepFocus.current.mode}
				seatAt={remDrag.seatAt}
				ruleAt={remDrag.ruleAt}
				dropping={remDrag.drag !== undefined}
				dropOver={!!remDrag.drag?.overNew}
				onRule={(reminder, characterId, tokenId) =>
					moveConfirm?.requestRule(reminder, characterId, tokenId)}
				onHints={(h) => (hints.tray = h)}
				run={flow.run}
				disabled={watching}
				instead={seatArr.arranging ? seatingBar : undefined}
				{remDrag}
				onRemove={(id) => moveConfirm?.requestReturn(id)}
			/>
		{/if}

		<!-- Measures the tap target, the height every reminder takes on the board. -->
		<span class="tap-probe" aria-hidden="true" bind:clientHeight={sizing.tapPx}></span>
		{#if boardRuleCount(game) > 0 || gameNotes > 0}
			{@const tokenSize = Math.max(sizing.tapPx, Math.round(size * 0.5))}
			<div class="rules-edge" bind:clientWidth={sizing.edgeW} bind:clientHeight={sizing.edgeH}>
				{#if boardRuleCount(game) > 0}{@render ruleTokens(tokenSize)}{/if}
				<!-- The game's notes after the Fabled and Loric, at their size, while there are any
				     (Trevor, 2026-10-31). Kept off a player's sight while the grim is shown. -->
				{#if gameNotes > 0}
					<GameNotesToken size={tokenSize} count={gameNotes} onclick={() => playersDialog.show()} />
				{/if}
			</div>
		{/if}
		<BoardCorner
			{game}
			{watching}
			corner={cornerInfo}
			gamePhase={phase}
			fitRoom={sizing.fitCorner}
			{width}
			{rootFont}
			{startedAt}
			endedAt={ended?.endedAt}
			editable
			onShare={() => (phonesOpen = true)}
			bind:titleW={sizing.titleW}
			bind:titleH={sizing.titleH}
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
		<!-- The day timer on the board too (Trevor, 2026-10-17); one timer for the app, with Back
		     to town at its front (Trevor, 2026-11-01). The Soundboard is in ⋯. -->
		<div class="board-timer" bind:clientWidth={sizing.timerW} bind:clientHeight={sizing.timerH}>
			<!-- Once the game ends the timer keeps its room, unseen, so no seat moves. -->
			<div class="timer-slot" class:gone={!showTimer} inert={!showTimer}>
				<DayTimer
					alive={livingByTeam(game).alive}
					variant="compact"
					readOnly={watching || !showTimer}
					shown={watchedTimer}
					{town}
				/>
			</div>
		</div>
	</div>
</div>

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
	onSoundboard={watching ? undefined : () => (soundboardOpen = true)}
	onGameInfo={() => (modeMenuOpen = true)}
	onCharacterSelection={startedAt === undefined && !setUp && !watching
		? () => goto(resolve('/grimoire/[gameId]/setup', { gameId: game.gameId }))
		: undefined}
	onAddSeat={() =>
		// The seat just appears (Trevor, 2026-10-16); with a room open, Travellers choose follows.
		startPlacing((p) => travellersForNewSeat(grimoire.addSeat(p), watching))}
	onAddRule={() => rules?.add()}
	onArrange={() => enterSeating(seatArr)}
	onExport={() => (exportOpen = true)}
	onFeedback={watching ? undefined : () => (feedbackOpen = true)}
	onReopen={() => (reopenOpen = true)}
	onNewGame={watching ? undefined : () => newGameSheet?.begin()}
	onCloseRoom={!watching && roomHost().code ? () => roomHost().close() : undefined}
	onShareGrim={!watching &&
	roomHost().status === 'open' &&
	roomHost().ended?.gameId === game.gameId &&
	roomHost().revealed?.gameId !== game.gameId
		? () => roomHost().reveal(grimoire.open) || toast(t('room.shareGrim.failed'))
		: undefined}
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
	editable={!watching}
	{startedAt}
	endedAt={ended?.endedAt}
	{phase}
	{watcherCount}
	onShare={watching ? undefined : () => (phonesOpen = true)}
/>
<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />
<BankReminderDialog {grimoire} {hand} onRemove={(id) => moveConfirm?.requestReturn(id)} />
<AlignmentAsk {grimoire} />
<StarPassPrompt {grimoire} active={!ended && !grimoire.open.viewOnly} />
<FirstDeathAsk {grimoire} />
<ExplosionAsk {grimoire} />
<ReincarnateAsk {grimoire} />
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
	bind:open={sheetOpen}
	{grimoire}
	seatId={selected}
	onDraw={(id) => {
		sheetOpen = false;
		onDraw(id);
	}}
	onNotes={(id) => editNote(id)}
	onReminder={showReminder}
	onNominated={nominated}
	onExecute={(seatId) => flow.executeFromSeat(seatId)}
/>

<SeatProfileDialog bind:open={profileOpen} {game} seatId={profileSeat} />

<!-- The board's nomination marks: who did this player nominate? (Trevor, 2026-10-23) -->
<NominationChooser {grimoire} {characters} bind:asking={nominatingFrom} onNominated={nominated} />

<HistoryDialog bind:open={historyOpen} {grimoire} />
{#if !watching}<LateSeatOnBoard {grimoire} place={startPlacing} />{/if}

<ExportGameDialog bind:open={exportOpen} load={exportGame} {capture} />
{#if !watching}
	<GameFeedbackSheet bind:open={feedbackOpen} {game} />
{/if}

<BoardScriptDialog bind:open={scriptOpen} {...playerView} testid="script-scroll" />

<!-- Over the board, so the Storyteller never leaves the game (Trevor, 2026-10-17). -->
<Dialog bind:open={phonesOpen} title={t('room.title')} size="full" shownToPlayers>
	<RoomPanel game={grimoire.open} />
</Dialog>

{#snippet coverActions()}
	<GrimCoverActions callTown={!ended && !!roomHost().code} view={playerView} />
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
	{town}
	onEndDay={() => (flow.endDayOpen = true)}
	onExecute={(seatId, cause) => flow.executeForMadness(seatId, cause)}
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
>
	{#snippet headActions()}<AidMenu aid="savantInfo" />{/snippet}
</ConfirmDialog>

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
	onShowGrimoire={() => (showingGrim = true)}
	{onDraw}
/>

<AlignmentDraw bind:open={drawOpen} {grimoire} seatId={drawFor} />

<BluffsSheet
	bind:open={bluffsOpen}
	{game}
	{characters}
	dispatch={(command) => grimoire.open.run(command)}
/>

<RuleCharacters bind:this={rules} {grimoire} {watching} onReminder={showReminder} />

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
	/* The board page's scroll lock is in GrimoirePage: a board inside a scrolling page (the
	   final grimoire on a phone, Public Town) leaves that page free to scroll. */
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
	/* While arranging, a press drags a seat instead of scrolling or zooming. */
	.arranging {
		touch-action: none;
		outline: 1px dashed var(--border);
		outline-offset: var(--space-1);
		border-radius: var(--radius-md);
	}
	/* Everything but a held seat and its reminders darkens (Trevor, 2026-10-26; BoardSeats). */
	.holding :global(.chip-slot:not(.on-held-seat)) {
		opacity: 0.35;
		transition: opacity 0.15s;
	}
	.tap-probe {
		position: absolute;
		visibility: hidden;
		height: var(--tap-target);
		pointer-events: none;
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
	/* Shown to a player: the seats only, with the room for the rest kept so nothing moves. */
	.board.showing :global(:is([data-tray], [data-testid='night-strip'])),
	.board.showing .board-timer,
	.board.showing :global([data-testid='game-notes-token']) {
		visibility: hidden;
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
	/* Small, in the board's top left corner, clear of the seats' ring. */
	.rules-edge {
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		z-index: 2;
	}
</style>
