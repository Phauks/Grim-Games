/**
 * Walking through the night on the board (GrimoireBoard): the pane's Night tab shows tonight's
 * steps one at a time (Trevor, 2026-10-16; beside the board since 2026-11-16), and on a phone
 * the strip under the board steps through them too.
 * Both come back after a reload or an update, from what this device saved. Run Night Order
 * leaves out dead players (Trevor, 2026-10-18) unless their ability is set off by dying
 * tonight; the Script screen still lists every step.
 */
import { untrack } from 'svelte';
import type { CharacterId, GameData } from '#lib/core/data/index.ts';
import {
	type CharacterLookup,
	type Game,
	type Reminder,
	type ReminderId,
	type SeatId
} from '#lib/core/model/index.ts';
import { noPlayerSeats, type SpecialRule } from '#lib/core/modes/index.ts';
import {
	nextScriptOrderTarget,
	ruleSources,
	scriptOrderSource
} from '#lib/core/rules/rule-sources.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { type Night } from '#lib/core/model/overrides.ts';
import { type NightStep } from '#lib/core/rules/night/night-order.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
import type { ReminderHand } from '#lib/features/board/reminder-hand.svelte.ts';
import { seatName } from './night-steps.ts';
import { boardNightSteps, stepHolders, tonight } from '#lib/core/rules/night/board-steps.ts';
import { stepReminders, stepTokenCharacter } from '#lib/features/board/reminders.ts';

/** What the walk-through reads from the board, fresh on each call. */
export interface NightWalkContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	/** The official night order, once loaded. */
	data: GameData | undefined;
	/** Since dawn: players whose character changed and who died (boardNightSteps). */
	today: Parameters<typeof boardNightSteps>[4];
	/** The game's special rules. */
	rules: readonly SpecialRule[];
	/** Whether a step wakes anyone tonight (the board's own rule, shared with its leaf numbers). */
	wakes: (step: NightStep) => boolean;
	/** The game is over. */
	ended: boolean;
	/** Seats are being arranged or a new seat placed: no night starts meanwhile. */
	busy: boolean;
	/** The token in hand, and the bank that hands over its tokens (ReminderBank's `hold`). */
	hand: ReminderHand;
	bank: { hold: (reminder: Pick<Reminder, 'characterId' | 'label'>) => boolean } | undefined;
}

/** A step's reminder already on the board, to move. */
export interface PlacedAt {
	reminderId: ReminderId;
	seatId: SeatId;
}

export class NightWalk {
	/** Walking through the night under the board: which night and which step. */
	walk = $state<{ night: Night; index: number } | undefined>();
	/**
	 * The step shown in the pane's Night tab: the walk-through's, kept as it was when shown so
	 * a step whose players change inside it stays put (guidedStep).
	 */
	guided = $state<{ step: NightStep; night: Night } | undefined>();
	/** The Night tab shows the step (on a phone, its sheet is open over the board). */
	guideOpen = $state(false);
	/** The step closed while one of its reminders is in hand, to open again once it is put down. */
	#placing = $state(false);
	/** The saved step dialog, until the night order can be worked out. */
	#pending = $state<{ night: Night; stepId: string } | undefined>();
	#context: () => NightWalkContext;

	/** Made while the board starts, so it can keep the saved view up to date. */
	constructor(context: () => NightWalkContext) {
		this.#context = context;
		const saved = context().grimoire.nightView;
		this.walk = saved.walk;
		this.#pending = saved.guided;
		// The saved step dialog opens once the night order can be worked out.
		$effect(() => {
			const pending = this.#pending;
			const { data } = this.#context();
			if (!pending || !data) return;
			this.#pending = undefined;
			const step = this.#steps(pending.night).find((s) => s.id === pending.stepId);
			if (step) {
				this.guided = { step, night: pending.night };
				this.guideOpen = true;
			}
		});
		$effect(() => {
			const { walk, guided } = this;
			this.#context().grimoire.saveNightView({
				walk: walk ? { ...walk } : undefined,
				guided:
					(this.guideOpen || this.#placing) && guided
						? { night: guided.night, stepId: guided.step.id }
						: this.#pending
			});
		});
		// The pane shows the walk-through's step: moving along the night shows the next one.
		// A change to the night's steps (a character changed) keeps the open step, moving the
		// walk-through to where it now is.
		let followed: typeof this.walk;
		$effect(() => {
			const walk = this.walk;
			const steps = this.steps;
			if (!walk || !this.#context().data) return;
			untrack(() => {
				const g = this.guided;
				const moved = walk !== followed;
				followed = walk;
				if (!moved && g && g.night === walk.night) {
					const i = steps.findIndex((s) => s.id === g.step.id);
					if (i >= 0 && i !== walk.index) this.walk = { ...walk, index: i };
					return;
				}
				const step = steps[walk.index];
				// By night too: Dusk and Dawn have the same id every night.
				if (step && (g?.step.id !== step.id || g.night !== walk.night))
					this.guided = { step, night: walk.night };
			});
		});
		// Ending the game (often at the dusk an Execution starts) closes the night's walk-through:
		// History's strip has the bottom of the board then (Trevor, 2026-10-24).
		$effect(() => {
			if (this.#context().ended) this.walk = undefined;
		});
		// The token in hand put down (on a seat, back in the bank or let go): the step again.
		$effect(() => {
			if (!this.#placing) return;
			if (this.guideOpen) this.#placing = false;
			else if (!this.#context().hand.held) {
				this.#placing = false;
				// After the key or tap that put it down, so an Escape doesn't close the step too.
				setTimeout(() => (this.guideOpen = true));
			}
		});
	}

	/**
	 * Puts one of the open step's reminders on the board (Trevor, 2026-11-06: "revert back to grim
	 * view, not a tabled list"): the step closes with the token in hand, from the bank or, to move
	 * it, from its seat, and the Storyteller taps the seat on the board. False when the bank has
	 * no such token, for the step's list of players instead.
	 */
	placeOnBoard(reminder: Pick<Reminder, 'characterId' | 'label'>, at?: PlacedAt): boolean {
		const { hand, bank } = this.#context();
		if (at) hand.held = { kind: 'placed', reminderId: at.reminderId, from: at.seatId };
		else if (!bank?.hold(reminder)) return false;
		this.#placing = true;
		this.guideOpen = false;
		return true;
	}

	/** Opens a step of the open step's night; the walk-through follows on tonight's. */
	open(step: NightStep): void {
		if (!this.guided) return;
		this.guided = { step, night: this.guided.night };
		if (this.walk && this.walk.night === this.guided.night) {
			const i = this.steps.findIndex((s) => s.id === step.id);
			if (i >= 0) this.walk = { ...this.walk, index: i };
		}
	}

	/**
	 * Next, as the strip's: ticks tonight's open step and opens the one after it. False past
	 * the last step, where the board shows where the night ends (Trevor, 2026-10-19).
	 */
	next(): boolean {
		const { walk, guided } = this;
		if (!walk || !guided || guided.night !== walk.night) return true;
		const { grimoire } = this.#context();
		const step = guided.step;
		if (!grimoire.isNightStepDone(walk.night, step))
			grimoire.toggleNightStep(walk.night, step, { startDay: false });
		const i = this.steps.findIndex((s) => s.id === step.id);
		const after = this.steps[i + 1];
		if (i < 0 || !after) return false;
		this.open(after);
		return true;
	}

	/** Every step of a night on this board, dead players' included. */
	#steps(night: Night): NightStep[] {
		const { game, characters, data, today, rules } = this.#context();
		return data ? boardNightSteps(game, characters, night, data, today, rules) : [];
	}

	/** A night's waking steps, for the Night tab between nights. */
	upcoming(night: Night): NightStep[] {
		const { wakes } = this.#context();
		return this.#steps(night).filter(wakes);
	}

	/** The walk-through's steps: those that wake someone tonight. */
	steps = $derived.by(() => {
		const { wakes } = this.#context();
		return this.walk ? this.#steps(this.walk.night).filter(wakes) : [];
	});

	/** The open step's night, for Previous and Next inside it, skipping the dead likewise. */
	guidedSteps = $derived.by(() => {
		const guided = this.guided;
		if (!guided) return [];
		const { wakes } = this.#context();
		return this.#steps(guided.night).filter((s) => s.id === guided.step.id || wakes(s));
	});

	/**
	 * The open step, its worked-out answers as the game stands now: `guided` keeps the step from
	 * when it opened, so an answer marked inside it (the Flowergirl's Yes or No) shows at once
	 * (Trevor, 2026-11-03). Only the answers of the same waking players are refreshed: the rest
	 * stays as opened, so a step whose players change inside it (the Snake Charmer's swap) keeps
	 * showing what happened.
	 */
	guidedStep = $derived.by(() => {
		const opened = this.guided?.step;
		const live = this.guidedSteps.find((s) => s.id === opened?.id);
		if (opened?.info?.kind !== 'answer' || live?.info?.kind !== 'answer') return opened;
		const seats = (info: { answers: { seatId: string }[] }) =>
			info.answers.map((a) => a.seatId).join(' ');
		return seats(live.info) === seats(opened.info) ? { ...opened, info: live.info } : opened;
	});

	/** The walk-through's step now. */
	step = $derived(this.walk ? this.steps[this.walk.index] : undefined);

	/**
	 * Every player who wakes for the step is poisoned, under a rule that keeps them asleep
	 * (I See Dead People, https://beardytas.com/garden-of-djinn/i-see-dead-people/): the
	 * rule's name, else none.
	 */
	asleepRule = $derived.by(() => {
		const { game, characters, rules } = this.#context();
		const rule = rules.find((r) => r.setup.deaths?.kind === 'private')?.name;
		const step = this.step;
		if (!rule || !step) return undefined;
		const holders = stepHolders(game, step, characters);
		const asleep =
			holders.length > 0 &&
			holders.every((seatId) =>
				abilityState(game, seatId, characters).impairments.some((i) => i.reason === 'poisoned')
			);
		return asleep ? rule : undefined;
	});

	/**
	 * Seat 7 wakes for the step under a rule that leaves it to no one (The Ballad of Seat 7,
	 * https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/): the Storyteller makes its
	 * choices. The rule's name, else none.
	 */
	emptySeatRule = $derived.by(() => {
		const { game, characters, rules } = this.#context();
		const rule = rules.find(
			(r) => r.setup.seats?.kind === 'storyteller-seat' && r.setup.seats.count > 0
		);
		const step = this.step;
		if (!rule || !step) return undefined;
		const empty = noPlayerSeats(game, rule.setup.seats);
		return stepHolders(game, step, characters).some((seatId) => empty.includes(seatId))
			? rule.name
			: undefined;
	});

	/**
	 * Trained Killer (https://beardytas.com/garden-of-djinn/trained-killer/): on a Demon's step
	 * after the first night, the next living in-play character in script order (`seat`) and
	 * the name of the rule source that says so (`by`, `demonAttack.target`).
	 */
	attack = $derived.by(() => {
		const { game, characters, rules } = this.#context();
		const rule = scriptOrderSource(ruleSources(game, characters, rules))?.name;
		const step = this.step;
		if (!rule || !step || this.walk?.night !== 'other') return undefined;
		if (step.character?.type !== 'demon') return undefined;
		const target = nextScriptOrderTarget(game, characters);
		return target === undefined ? undefined : { seat: seatName(game, target), by: rule };
	});

	/**
	 * Run Night Order in one tap, from the right end of the reminder bank (Trevor, 2026-10-18:
	 * a change on the board itself, not a toolbar page). Always there while the walk-through
	 * setting is on, so the bank never moves; usable once a seat has a character, empty seats
	 * or not (warn, never lock: it is the only way into the night steps on the board).
	 */
	canRun = $derived.by(() => {
		const { grimoire, game, ended, busy } = this.#context();
		return (
			!ended &&
			!grimoire.open.viewOnly &&
			!this.walk &&
			!busy &&
			game.seating.some((id) => game.seats[id].characterId !== undefined)
		);
	});

	/**
	 * While the night is walked through, the bank's button is End night, which replaces
	 * ticking Dawn (Trevor, 2026-10-18). A walk-through stopped mid-night shows Run night
	 * again, to pick it up at the first step not done: with the night order sheet gone it is
	 * the only way back to the steps. With the walk-through switched off it is End night all
	 * the time, usable while a night runs (Dusk ticked by End day).
	 */
	nightOn = $derived.by(() => {
		const { grimoire, ended } = this.#context();
		return (
			!ended &&
			(this.walk !== undefined ||
				(grimoire.nightRunning && !preferences.current.assistance.nightWalkthrough))
		);
	});

	/**
	 * Starts tonight's walk-through: from Dusk when the night starts (Trevor, 2026-10-20),
	 * else at the first step not yet done.
	 */
	run(fromDusk = false): void {
		const { grimoire, game, data, wakes } = this.#context();
		if (!data) return;
		grimoire.beginNight();
		const night = tonight(game);
		const steps = this.#steps(night).filter(wakes);
		const next = fromDusk ? 0 : steps.findIndex((step) => !grimoire.isNightStepDone(night, step));
		this.walk = { night, index: Math.max(0, next) };
	}

	/**
	 * The step's reminders already on the board are ringed too, on any night (Trevor,
	 * 2026-10-18: the Butler's Master placed on the first night).
	 */
	#labels = $derived.by(() => {
		const { walk, step } = this;
		// A gained ability's step rings that character's tokens (M50).
		const of = step ? stepTokenCharacter(step, this.#context().characters) : undefined;
		return walk && of
			? [...stepReminders(of.id, walk.night, of).labels, ...of.reminders]
			: undefined;
	});

	/** Whether a reminder is one of the walk-through step's. */
	isStepReminder = (r: { characterId: CharacterId; label: string }): boolean =>
		this.step?.character?.id === r.characterId && (this.#labels?.includes(r.label) ?? false);

	/** Who wakes for the walk-through's step, marked on the board. */
	holders = $derived.by(() => {
		const { game, characters } = this.#context();
		return this.step ? stepHolders(game, this.step, characters) : [];
	});
}
