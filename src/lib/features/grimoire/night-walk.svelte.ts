/**
 * Walking through the night on the board (GrimoireBoard): the strip under the board steps
 * through tonight's night order, and a step can open in its own dialog (Trevor, 2026-10-16).
 * Both come back after a reload or an update, from what this device saved. Run Night Order
 * leaves out dead players (Trevor, 2026-10-18) unless their ability is set off by dying
 * tonight; the Script screen still lists every step.
 */
import type { CharacterId, GameData } from '#lib/core/data/index.ts';
import { seatNumber, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
import { nextScriptOrderTarget, type SpecialRule } from '#lib/core/modes/index.ts';
import { abilityState, type Night, type NightStep } from '#lib/core/rules/index.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { boardNightSteps, seatName, stepHolders, tonight } from './night-steps.ts';
import { stepReminders } from './reminders.ts';

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
}

export class NightWalk {
	/** Walking through the night under the board: which night and which step. */
	walk = $state<{ night: Night; index: number } | undefined>();
	/** The step open in its own dialog. */
	guided = $state<{ step: NightStep; night: Night } | undefined>();
	guideOpen = $state(false);
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
					this.guideOpen && guided ? { night: guided.night, stepId: guided.step.id } : this.#pending
			});
		});
	}

	/** Every step of a night on this board, dead players' included. */
	#steps(night: Night): NightStep[] {
		const { game, characters, data, today, rules } = this.#context();
		return data ? boardNightSteps(game, characters, night, data, today, rules) : [];
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

	/** The walk-through's step now. */
	step = $derived(this.walk ? this.steps[this.walk.index] : undefined);

	/**
	 * Every player who wakes for the step is poisoned, under a rule that keeps them asleep
	 * (I See Dead People, https://beardytas.com/garden-of-djinn/i-see-dead-people/): the
	 * rule's name, else none.
	 */
	asleepRule = $derived.by(() => {
		const { game, characters, rules } = this.#context();
		const rule = rules.find((r) => r.parts.deaths?.kind === 'private')?.name;
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
			(r) => r.parts.seats?.kind === 'storyteller-seat' && r.parts.seats.count > 0
		)?.name;
		const step = this.step;
		if (!rule || !step) return undefined;
		return stepHolders(game, step, characters).some((seatId) => seatNumber(game, seatId) === 7)
			? rule
			: undefined;
	});

	/**
	 * Trained Killer (https://beardytas.com/garden-of-djinn/trained-killer/): on a Demon's step
	 * after the first night, the next living in-play character in script order (`seat`) and
	 * the rule's name (`by`).
	 */
	attack = $derived.by(() => {
		const { game, characters, rules } = this.#context();
		const rule = rules.find((r) => r.parts.demonAttacks)?.name;
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
		return walk && step?.character
			? [
					...stepReminders(step.character.id, walk.night, step.character).labels,
					...step.character.reminders
				]
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
