/**
 * Moving the game from one phase to the next on the board (GrimoireBoard): the bank's one
 * button (Set up, Start game, End night, Run night, Execution) and the questions each asks
 * first. PhaseDialogs draws those questions.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import type { DayMark, ExecutionOutcome } from '#lib/core/rules/index.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import { currentSetupStep } from '#lib/features/setup/setup-steps.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { gameStarts } from '#lib/features/grimoire/device-notes.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
import type { NightWalk } from '#lib/features/grimoire/night-walk.svelte.ts';
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
	/** The first night started (the board rereads when the game started). */
	started(): void;
	/** Offers the Savant's information after a night. */
	offerSavant(): void;
}

export class PhaseFlow {
	endNightOpen = $state(false);
	endDayOpen = $state(false);
	/** Start game asked with setup reminders still in the bank: those reminders. */
	startAskOpen = $state(false);
	setupLeft = $state<TrayItem[]>([]);
	/** Start game asked with seats still without a character (Trevor, 2026-11-01): those seats. */
	noCharacter = $state<SeatId[]>([]);
	/** A seat's status chose Executed: during the day, the day's Execution asks with them chosen. */
	executeChosen = $state<SeatId>();
	/** A mad player broke madness: the character whose madness executes them (L84). */
	executeCause = $state<CharacterId>();
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
		seatId: SeatId | undefined,
		save: CharacterId | 'dies' | undefined,
		marks: Partial<Record<DayMark, boolean>>,
		keepGoing: boolean,
		outcome?: ExecutionOutcome
	): void {
		const { grimoire, game } = this.#context();
		for (const [mark, value] of Object.entries(marks) as [DayMark, boolean][])
			grimoire.run({ type: 'SetDayMark', mark, value });
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
	 */
	startGame(): void {
		const { game, characters } = this.#context();
		const left = pendingSetup(game, characters);
		const empty = game.seating.filter((id) => game.seats[id]?.characterId === undefined);
		if (left.length > 0 || empty.length > 0) {
			this.setupLeft = left;
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
		// Into the day, or stay on the grimoire (Trevor, 2026-10-18: a Storyteller setting).
		if (preferences.current.assistance.dayAfterNight) setDayOpen(true);
		offerSavant();
	}

	/**
	 * The bank's button follows the game (Trevor, 2026-10-19): Set up while tokens are still
	 * to be handed out (the game flow comes from this one button; the board has no other Set
	 * up button), then Start game before the first night, End night during a night, End day
	 * during a day; a walk-through stopped mid-night offers Run night to pick it up again.
	 */
	readonly run = $derived.by(() => {
		const { grimoire, game, nw, showSetup, ended, busy } = this.#context();
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
			onclick: () => {
				this.endDayOpen = true;
			}
		};
	});
}
