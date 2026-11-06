/**
 * Moving the game from one phase to the next on the board (GrimoireBoard): the bank's one
 * button (Set up, Start game, End night, Run night, Execution) and the questions each asks
 * first. PhaseDialogs draws those questions.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import {
	executionAsks,
	pendingSetupAlignments,
	storytellerNominee,
	type ExecutionOutcome,
	type SetupAlignmentTask
} from '#lib/core/rules/index.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import { currentSetupStep } from '#lib/features/setup/setup-steps.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { gameStarts } from '#lib/features/grimoire/device-notes.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
import type { NightWalk } from '#lib/features/grimoire/night-walk.svelte.ts';
import type { ReminderHand } from '#lib/features/grimoire/reminder-hand.svelte.ts';
import { tonight } from '#lib/features/grimoire/night-steps.ts';
import { pendingSetup, type TrayItem } from '#lib/features/grimoire/setup-tray.ts';

/** What the phase flow reads from the board, fresh on each call. */
export interface PhaseFlowContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	nw: NightWalk;
	/** Tokens are still to be handed out: the bank offers Set up. */
	showSetup: boolean;
	/** The game is over. */
	ended: boolean;
	/** Seats are being arranged or a new seat placed. */
	busy: boolean;
	/** Opens or closes the day view. */
	setDayOpen(open: boolean): void;
	/** Closes the seat sheet, for an Execution chosen from a seat's status. */
	closeSeat(): void;
	/** Start game not yet tapped: the day's Execution opens its sheet, which warns. */
	notStarted: boolean;
	/** The reminder in hand: put down when Execution asks, and picking one up ends the ask. */
	hand: ReminderHand;
	/** The first night started (the board rereads when the game started). */
	started(): void;
	/** Offers the Savant's information after a night. */
	offerSavant(): void;
}

/** The board's pick for no execution, and for the Storyteller executed (the Atheist). */
export const NO_EXECUTION = 'none';
export const STORYTELLER = 'storyteller';

export class PhaseFlow {
	endNightOpen = $state(false);
	endDayOpen = $state(false);
	/** Start game asked with setup reminders still in the bank: those reminders. */
	startAskOpen = $state(false);
	setupLeft = $state<TrayItem[]>([]);
	/** Setup alignment changes not yet made (the Bounty Hunter's evil Townsfolk, M22). */
	alignmentsLeft = $state<SetupAlignmentTask[]>([]);
	/** Start game asked with seats still without a character (Trevor, 2026-11-01): those seats. */
	noCharacter = $state<SeatId[]>([]);
	/** A seat's status chose Executed: during the day, the day's Execution asks with them chosen. */
	executeChosen = $state<SeatId>();
	/** A mad player broke madness: the character whose madness executes them (L84). */
	executeCause = $state<CharacterId>();
	/**
	 * The executed player is being tapped on the board (Trevor, 2026-11-06, option B):
	 * `picking` while the board's bar asks, and the pick so far: a seat, No execution, or the
	 * Storyteller (the Atheist on the script).
	 */
	picking = $state(false);
	picked = $state<SeatId | typeof NO_EXECUTION | typeof STORYTELLER>();
	/** Counts Next taps past the walk-through's last step; each lights up End night. */
	endHint = $state(0);
	#context: () => PhaseFlowContext;

	constructor(context: () => PhaseFlowContext) {
		this.#context = context;
		$effect(() => {
			if (this.endDayOpen) return;
			this.executeChosen = undefined;
			this.executeCause = undefined;
		});
		// A token picked up, or the game ending, ends the Execution pick.
		$effect(() => {
			if (!this.picking) return;
			const { hand, ended } = this.#context();
			if (hand.held || ended) this.cancelPick();
		});
	}

	/**
	 * End day, from the bank or the day view (Trevor, 2026-10-18): the day's timer stops and
	 * Dusk is ticked, which runs the rules checked at dusk (GameEndPrompt); the walk-through
	 * starts on the board, where it is on.
	 */
	endDay(): void {
		const { grimoire, game, nw, setDayOpen } = this.#context();
		setDayOpen(false);
		if (liveDayTimer.running) liveDayTimer.toggle();
		grimoire.beginNight();
		const night = tonight(game);
		if (!grimoire.isNightStepDone(night, { id: 'dusk' }))
			grimoire.toggleNightStep(night, { id: 'dusk' });
		if (preferences.current.assistance.nightWalkthrough) nw.run(true);
	}

	/**
	 * Execution, from the bank or the day view: the board asks for the executed player, with an
	 * execution already logged today picked to start with. Before Start game the sheet opens
	 * instead, as it warns (Trevor, 2026-11-01), and with the Atheist on the script, which
	 * offers the Storyteller.
	 */
	startExecution(): void {
		const { game, characters, notStarted, setDayOpen, hand } = this.#context();
		// The Atheist's Storyteller is chosen on the sheet, as the board has no seat for them.
		if (notStarted || storytellerNominee(game, characters)) {
			this.endDayOpen = true;
			return;
		}
		setDayOpen(false);
		hand.putDown();
		const entry = game.today.entries.findLast(
			(e) => e.kind === 'execution' || e.kind === 'storyteller-execution'
		);
		this.picked =
			entry?.kind === 'execution'
				? entry.seatId
				: entry?.kind === 'storyteller-execution'
					? STORYTELLER
					: undefined;
		this.picking = true;
	}

	/**
	 * A seat tapped while the board asks: it is picked, or, when executing them has more to
	 * decide (a save, the Scapegoat, the Judge: `executionAsks`), the Execution sheet opens with
	 * them chosen.
	 */
	pick(seatId: SeatId | typeof NO_EXECUTION | typeof STORYTELLER): void {
		const { game, characters } = this.#context();
		const player = seatId !== NO_EXECUTION && seatId !== STORYTELLER;
		const logged = game.today.entries.some((e) => e.kind === 'execution' && e.seatId === seatId);
		if (player && !logged && executionAsks(game, seatId, characters)) {
			this.picking = false;
			this.executeChosen = seatId;
			this.endDayOpen = true;
			return;
		}
		this.picked = seatId;
	}

	/** The board's Confirm: the pick is executed and the day ends. */
	confirmPick(): void {
		const picked = this.picked;
		if (picked === undefined) return;
		this.picking = false;
		this.picked = undefined;
		if (picked === NO_EXECUTION) this.executeAndEndDay(undefined, undefined, false);
		else this.executeAndEndDay(picked, undefined, false);
	}

	cancelPick(): void {
		this.picking = false;
		this.picked = undefined;
	}

	/** The seat picked so far, if a player is. */
	get pickedSeat(): SeatId | undefined {
		const picked = this.picked;
		return picked === undefined || picked === NO_EXECUTION || picked === STORYTELLER
			? undefined
			: picked;
	}

	/** Executed from a seat's status: true when the day's Execution asks, with them chosen. */
	executeFromSeat(seatId: SeatId): boolean {
		if (this.run.label !== t('day.execution') || this.run.disabled) return false;
		this.#context().closeSeat();
		this.executeChosen = seatId;
		this.endDayOpen = true;
		return true;
	}

	/**
	 * A mad player broke madness that executes (L84): the day's Execution asks with them
	 * chosen, executed by the character whose madness it is.
	 */
	executeForMadness(seatId: SeatId, cause: CharacterId): void {
		this.executeChosen = seatId;
		this.executeCause = cause;
		this.endDayOpen = true;
	}

	/**
	 * Execution ends the day (Trevor, 2026-10-22): the player chosen is executed first, unless
	 * that execution is already logged, so the rules checked at dusk see it.
	 */
	executeAndEndDay(
		seatId: SeatId | 'storyteller' | undefined,
		save: CharacterId | 'dies' | undefined,
		keepGoing: boolean,
		outcome?: ExecutionOutcome
	): void {
		const { grimoire, game } = this.#context();
		// The Storyteller executed ends the game, so the day stays for End game (`gameEnds`).
		if (seatId === 'storyteller') {
			if (!game.today.entries.some((e) => e.kind === 'storyteller-execution'))
				grimoire.run({ type: 'ExecuteStoryteller' });
			return;
		}
		const logged = game.today.entries.some((e) => e.kind === 'execution' && e.seatId === seatId);
		const cause = seatId === this.executeChosen ? this.executeCause : undefined;
		if (seatId && !logged)
			grimoire.run({
				type: 'Execute',
				seatId,
				...(save === 'dies' ? { dies: true } : save ? { savedBy: save } : {}),
				...(cause ? { cause } : {}),
				...(outcome ? { outcome } : {})
			});
		// Keep the day going (Trevor, 2026-10-26): a player may still nominate after it. An
		// explosion (the Boomdandy's) keeps it too, for who lives and the pointing.
		if (!keepGoing && !grimoire.explosionAsk) this.endDay();
	}

	/**
	 * Start game with setup reminders still in the bank's Setup stretch (Trevor, 2026-10-20),
	 * or with seats that have no character (Trevor, 2026-11-01: "i was able to start a game
	 * with 0 characters"), asks first, listing them; Confirm starts anyway (warn, never lock).
	 * So does a setup alignment change not yet made, such as no evil Townsfolk with the Bounty
	 * Hunter (M22).
	 */
	startGame(): void {
		const { game, characters } = this.#context();
		const left = pendingSetup(game, characters);
		const alignments = pendingSetupAlignments(game, characters);
		const empty = game.seating.filter((id) => game.seats[id]?.characterId === undefined);
		if (left.length > 0 || empty.length > 0 || alignments.length > 0) {
			this.setupLeft = left;
			this.alignmentsLeft = alignments;
			this.noCharacter = empty;
			this.startAskOpen = true;
			return;
		}
		this.beginGame();
	}

	beginGame(): void {
		const { game, nw, started } = this.#context();
		gameStarts.start(game.gameId);
		started();
		if (preferences.current.assistance.nightWalkthrough) nw.run();
		else this.endDay();
	}

	/** Setup's next step: Characters, or the bag draw once they are chosen. */
	openSetup(): void {
		const { game } = this.#context();
		goto(
			currentSetupStep(game) === 'draw'
				? resolve('/grimoire/[gameId]/draw', { gameId: game.gameId })
				: resolve('/grimoire/[gameId]/setup', { gameId: game.gameId })
		);
	}

	endNight(): void {
		const { grimoire, nw, setDayOpen, offerSavant } = this.#context();
		if (!grimoire.endNight()) return;
		nw.walk = undefined;
		// Dawn's Reset Reminders first, when it asks; then the day.
		grimoire.afterDawnAsk(() => {
			// Into the day, or stay on the grimoire (Trevor, 2026-10-18: a Storyteller setting).
			if (preferences.current.assistance.dayAfterNight) setDayOpen(true);
			offerSavant();
		});
	}

	/**
	 * The bank's button follows the game (Trevor, 2026-10-19): Set up while tokens are still
	 * to be handed out (the game flow comes from this one button; the board has no other Set
	 * up button), then Start game before the first night, End night during a night, End day
	 * during a day; a walk-through stopped mid-night offers Run night to pick it up again.
	 */
	readonly run = $derived.by(() => {
		const { grimoire, game, nw, showSetup, ended, busy } = this.#context();
		// While the board asks for the executed player, the bank's button is its Confirm, beside
		// the bar's Cancel (Trevor, 2026-11-06).
		if (this.picking)
			return {
				label: t('common.confirm'),
				text: t('common.confirm'),
				icon: 'check' as const,
				disabled: this.picked === undefined,
				onclick: () => this.confirmPick()
			};
		if (nw.nightOn)
			return {
				label: 'End night',
				text: 'End night',
				icon: 'day' as const,
				disabled: grimoire.open.viewOnly,
				onclick: () => {
					this.endNightOpen = true;
				},
				hint: this.endHint
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
				disabled: busy,
				onclick: () => this.openSetup()
			};
		if (game.pastDays.length === 0)
			return {
				label: 'Start game',
				text: 'Start game',
				icon: 'night' as const,
				disabled: !nw.canRun,
				onclick: () => this.startGame()
			};
		// Execution in place of End day (Trevor, 2026-10-22): ending a day asks who was executed.
		return {
			label: t('day.execution'),
			text: t('day.execution'),
			icon: 'night' as const,
			disabled: ended || grimoire.open.viewOnly || busy,
			onclick: () => this.startExecution()
		};
	});
}
