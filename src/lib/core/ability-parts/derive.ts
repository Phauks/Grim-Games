/**
 * SPIKE: compiles an ability's parts into what the app reads today: the rules keys in
 * `character-rules.ts`, whether it wakes on the first night and on other nights (TPI's night
 * sheet today), and the Sort Order phrase its text opens with (`data/sort-order.ts`).
 *
 * Only the keys below are derived; everything else in a rules block (day reminders, night
 * text, setup preparation, most reminder placement) stays hand-written for now. The spike's
 * test compares each derived key with today's rules files, so every difference is either a
 * bug in the parts, a gap in today's rules, or a choice to record.
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { DeathCauseRule } from '#lib/core/data/death-cause-rules.ts';
import type { EndsGame, HoldsGame } from '#lib/core/data/game-end-rules.ts';
import type { CharacterType, ReminderLabel } from '#lib/core/data/types.ts';
import type { AbilityParts, Clause, Condition, Effect } from './types.ts';

/** The rules keys this compiler fills in. */
export const DERIVED_KEYS = [
	'actsWhenDead',
	'onDeath',
	'protects',
	'redirectsKill',
	'survivesFirstDeath',
	'kills',
	'deathCheck',
	'impairs',
	'registersAs',
	'onNominated',
	'gameEnd',
	'becomes',
	'keepsAbility',
	'stopsWaking',
	'curses',
	'choosesLikeDemon',
	'setupModifier',
	'learns',
	'answers',
	'marksChoice',
	'nominationsAfterExecution',
	'deathCause',
	'fixedReminders',
	'targetSeats'
] as const;
export type DerivedKey = (typeof DERIVED_KEYS)[number];

/**
 * `fixedReminders` stands for `reminderMovement.fixed`; `targetSeats` for the `seat` of each
 * chosen player's reminder in `reminderTargets`. `deathCause` is derived only when the ability
 * can cause a death: the `none` reasons are our own words, not parts.
 */
export type DerivedRules = Pick<
	CharacterRules,
	Exclude<DerivedKey, 'fixedReminders' | 'targetSeats'>
> & {
	fixedReminders?: ReminderLabel[];
	targetSeats?: Record<ReminderLabel, 'any' | 'other' | 'self'>;
};

export interface Derived {
	rules: DerivedRules;
	wakes: { firstNight: boolean; otherNight: boolean };
	/** The Sort Order phrase the ability text should open with, when its timing decides it. */
	opening?: string;
}

const alive = (conditions: Condition[] | undefined) =>
	conditions?.flatMap((c) => ('alive' in c ? [c.alive] : []))[0];

const registers = (conditions: Condition[] | undefined, who: string) =>
	conditions?.flatMap((c) => ('registers' in c && c.registers.who === who ? [c.registers] : []))[0];

const has = (conditions: Condition[] | undefined, test: (c: Condition) => boolean) =>
	!!conditions?.some(test);

/** Every effect of a clause, with those an `arm` or `later` holds. */
function allEffects(effects: readonly Effect[]): Effect[] {
	return effects.flatMap((e) =>
		e.do === 'arm' || e.do === 'later' ? [e, ...allEffects(e.effects)] : [e]
	);
}

/** Whether a clause wakes its player: on the first night, on other nights. */
function clauseWakes(clause: Clause): { first: boolean; other: boolean } {
	const { when } = clause;
	const effects = allEffects(clause.effects);
	if (when.at === 'night')
		return { first: when.nights !== 'each*', other: when.nights !== 'first' };
	// Told something before the game starts (the Evil Twin, the Lunatic's Demon): night 1.
	const first = when.at === 'setup' && effects.some((e) => e.do === 'learn');
	// Carousel Demons: a numbered day ("On day 3", "After day 5") is counted with Day N tokens
	// the Storyteller moves each night (the Riot, the Leviathan).
	if (
		(when.at === 'day' && typeof when.days === 'number') ||
		(when.at === 'dusk' && when.day !== undefined)
	)
		return { first, other: true };
	// Woken as the Demon they think they are (the Lunatic).
	if (effects.some((e) => e.do === 'believe' && e.isA === 'demon')) return { first, other: true };
	// Something happens tonight because of a day's event (Gossip, Moonchild, Juggler).
	if (effects.some((e) => e.do === 'later')) return { first, other: true };
	// Acts on their own death (Ravenkeeper, Sage, Sweetheart, Barber), unless only by day when
	// they learn it, or by execution.
	if (when.at === 'death' && !when.would && !when.learned && when.by !== 'execution')
		return { first, other: true };
	// Told they became the Demon (Scarlet Woman), or die with their Grandchild.
	if (when.at === 'event' && ['demon-dies', 'grandchild-killed-by-demon'].includes(when.event))
		return { first, other: true };
	// A death the Storyteller may cause at any time (the Tinker) has a step on other nights.
	if (when.at === 'always' && clause.storytellerMay && effects.some((e) => e.do === 'kill'))
		return { first, other: true };
	return { first, other: false };
}

/** The Sort Order phrase for a clause's timing, if the timing alone decides it. */
function clauseOpening(clause: Clause): string | undefined {
	const { when, limit } = clause;
	const onlyLearns = clause.effects.every((e) => e.do === 'learn');
	if (when.at === 'night') {
		const star = when.nights === 'each*' ? '*' : '';
		if (limit === 'once-per-game') return `Once per game, at night${star}`;
		if (when.nights === 'first') return onlyLearns ? 'You start knowing' : 'On your 1st night';
		return `Each night${star}`;
	}
	if (when.at === 'day') {
		if (when.days === 'first') return 'On your 1st day';
		if (typeof when.days === 'number') return undefined;
		return limit === 'once-per-game' ? 'Once per game, during the day' : 'Each day';
	}
	if (when.at === 'nominated' && limit === 'first-time') return 'The 1st time';
	if (when.at === 'death' && when.learned) return 'When you learn that you died';
	if (when.at === 'death' && !when.would && (when.phase || when.by === 'execution'))
		return 'If you die';
	return undefined;
}

/** Death causes from weakest to strongest; a clause never lowers what another set. */
const CAUSE_RANK = ['gained-ability', 'own-death', 'execution', 'kills'];
function cause(rules: DerivedRules, next: DeathCauseRule): void {
	const rank = (r?: DeathCauseRule) => (r && 'kind' in r ? CAUSE_RANK.indexOf(r.kind) : -1);
	if (rank(next) >= rank(rules.deathCause)) rules.deathCause = next;
}

interface Acc {
	fixed: Set<ReminderLabel>;
	ends: EndsGame[];
	holds: HoldsGame[];
	/** The character's first reminder its clauses mark, for a rule naming "its" token. */
	firstMark?: ReminderLabel;
	killsOthers: boolean;
}

export function deriveRules(parts: AbilityParts, type: CharacterType): Derived {
	const rules: DerivedRules = {};
	const marksChoice: ReminderLabel[] = [];
	const acc: Acc = {
		fixed: new Set(),
		ends: [],
		holds: [],
		firstMark: parts.clauses.find((c) => c.marks)?.marks,
		killsOthers: false
	};
	const wakes = { firstNight: false, otherNight: false };

	for (const clause of parts.clauses) {
		const { when } = clause;
		const effects = allEffects(clause.effects);
		// A condition about today that the night info works out (the Godfather's Outsider death).
		for (const c of clause.if ?? [])
			if ('today' in c && c.today === 'outsider-died')
				rules.answers = { question: 'outsider-died', ...(c.token ? { token: c.token } : {}) };
		const w = clauseWakes(clause);
		wakes.firstNight ||= w.first;
		wakes.otherNight ||= w.other;

		const survivesOnce = when.at === 'death' && when.would && clause.limit === 'first-time';
		if (clause.evenIfDead || (when.at === 'death' && !survivesOnce)) rules.actsWhenDead = true;
		if (when.at === 'death' && !when.would && when.by !== 'execution')
			rules.onDeath = {
				by: when.by === 'demon' ? 'demon' : 'any',
				...(when.phase === 'night' ? { night: true } : {})
			};

		if (clause.spent) acc.fixed.add(clause.spent);
		const permanent =
			when.at === 'setup' ||
			(when.at === 'night' && when.nights === 'first') ||
			(clause.limit === 'once-per-game' && effects.every((e) => e.do !== 'kill'));
		if (clause.marks && permanent) acc.fixed.add(clause.marks);

		// Where the clause's token goes: on its own player when every effect is theirs (the
		// Gambler's Dead), else on a chosen player, never its own when it can't choose itself:
		// "not yourself", a dead player while it lives, an alive one once it has died.
		const subjects = effects.flatMap((e) =>
			(['who', 'with'] as const).flatMap((k) => (k in e ? [(e as Record<string, unknown>)[k]] : []))
		);
		const onSelf = subjects.every((who) => who === 'self');
		const choice = clause.choose;
		const neverSelf =
			choice?.notSelf ||
			(choice?.dead && !clause.evenIfDead) ||
			(choice?.alive && when.at === 'death');

		const choosesPlayer = choice && choice.what !== 'character';
		const demonKill = type === 'demon' && effects.some((e) => e.do === 'kill');
		// Carousel Demons: a choice someone else makes (Lil' Monsta's Minions) isn't its player's.
		if (when.at === 'night' && choosesPlayer && clause.marks && !demonKill && !onSelf && !choice.by)
			marksChoice.push(clause.marks);
		if (choice && clause.marks)
			rules.targetSeats = {
				...rules.targetSeats,
				[clause.marks]: onSelf ? 'self' : neverSelf ? 'other' : 'any'
			};

		for (const effect of clause.effects) applyEffect(effect, clause, type, rules, acc, false);
	}

	if (marksChoice.length) rules.marksChoice = marksChoice;
	if (acc.ends.length || acc.holds.length || rules.gameEnd)
		rules.gameEnd = {
			...rules.gameEnd,
			...(acc.ends.length ? { ends: acc.ends } : {}),
			...(acc.holds.length ? { holds: acc.holds } : {})
		};
	if (acc.fixed.size) rules.fixedReminders = [...acc.fixed].sort();
	const opening = parts.clauses.filter((c) => c.when.at !== 'setup').map(clauseOpening)[0];
	return { rules, wakes, ...(opening ? { opening } : {}) };
}

function applyEffect(
	effect: Effect,
	clause: Clause,
	type: CharacterType,
	rules: DerivedRules,
	acc: Acc,
	/** Inside a `later`: it happens tonight, whatever the clause's own moment. */
	tonight: boolean,
	/** The clause's conditions, and a `later`'s own. */
	conds: Condition[] | undefined = clause.if,
	/** Inside an `arm`: it happens when its subject acts, not at the clause's moment. */
	armed = false
): void {
	const { when } = clause;
	const marks = effect.marks ?? clause.marks;
	switch (effect.do) {
		case 'learn': {
			const { info } = effect;
			if ('measure' in info) rules.learns = { ...info };
			else if ('question' in info) rules.answers = { ...info };
			if ('measure' in info && when.at === 'night' && when.nights === 'first')
				for (const label of Object.values(info.reminders ?? {})) acc.fixed.add(label);
			return;
		}
		case 'protect': {
			if (effect.once && effect.who === 'self') {
				// The Zombuul's "live but register as dead" is a game-end rule; the Fool's is this.
				if (!clause.effects.some((e) => e.do === 'register-dead') && clause.spent)
					rules.survivesFirstDeath = { spentToken: clause.spent };
				return;
			}
			// A protection from the Demon is a night one already, so `night` adds nothing.
			const night =
				effect.until === 'tonight' && effect.from !== 'demon' ? { night: true as const } : {};
			const neighbours = has(clause.if, (c) => 'neighboursGood' in c)
				? { whileNeighboursGood: true as const }
				: {};
			// Carousel Demons: safe only while its token's carrier lives (the Lleech). The grimoire
			// can't tell, so the Storyteller decides, and the player counts as alive for the game's
			// end while the carrier lives.
			const carrier = clause.if?.flatMap((c) => ('carrierAlive' in c ? [c.carrierAlive] : []))[0];
			if (effect.who === 'self' && carrier) {
				rules.protects = { who: 'self', from: effect.from, storytellerDecides: true };
				rules.gameEnd = { ...rules.gameEnd, aliveWhileDead: { whileCarrierAlive: carrier } };
			} else if (effect.who === 'self')
				rules.protects = { who: 'self', from: effect.from, ...night };
			else if (effect.who === 'executed' && clause.storytellerMay)
				rules.protects = { who: 'good', from: effect.from, storytellerDecides: true };
			else if (marks)
				rules.protects = {
					who: 'marked',
					token: marks,
					from: effect.from,
					...night,
					...neighbours
				};
			return;
		}
		case 'redirect-death':
			if (when.at === 'death') rules.redirectsKill = { from: when.by ?? 'any' };
			return;
		case 'kill': {
			const reg = registers(conds, effect.who);
			const as = reg?.types?.[0] ?? reg?.alignments?.[0];
			if (effect.who === 'self') cause(rules, { kind: 'own-death' });
			else if (as === 'demon' || as === 'good')
				cause(rules, {
					kind: 'kills',
					victim: { who: 'registers', as, ...(when.at === 'death' ? { notSelf: true } : {}) }
				});
			else cause(rules, { kind: 'kills' });
			if (has(clause.if, (c) => 'choice' in c && c.choice === 'guess-wrong'))
				rules.deathCheck = { kind: 'wrong-guess' };
			if (when.at === 'event' && when.event === 'grandchild-killed-by-demon' && acc.firstMark)
				rules.deathCheck = { kind: 'marked-killed-by-demon', token: acc.firstMark };
			// `kills` is the night step's kill; a day kill (the Slayer's shot) is a death cause.
			if ((when.at !== 'night' && !tonight) || armed) return;
			if (effect.who !== 'self') acc.killsOthers = true;
			rules.kills = {
				by: type === 'demon' ? 'demon' : 'other',
				...(effect.who === 'self' && !acc.killsOthers ? { targets: 'self' as const } : {}),
				...(effect.ignoresProtection || rules.kills?.ignoresProtection
					? { ignoresProtection: true }
					: {})
			};
			return;
		}
		case 'impair': {
			const whileWorks = effect.whileWorks ? { whileWorks: true } : {};
			if (effect.who === 'self') rules.impairs = { ...rules.impairs, self: { reason: effect.as } };
			else if (marks && ['chosen', 'another-player', 'each-player'].includes(effect.who))
				rules.impairs = {
					...rules.impairs,
					tokens: {
						...rules.impairs?.tokens,
						[marks]: {
							reason: effect.as,
							on: effect.who === 'each-player' ? 'others' : 'carrier',
							...whileWorks
						}
					}
				};
			return;
		}
		case 'lose-ability': {
			const count = alive(clause.if);
			rules.impairs = {
				...rules.impairs,
				self: { reason: 'no-ability', ...(count?.exactly ? { aliveAtMost: count.exactly } : {}) }
			};
			return;
		}
		case 'register':
			if (effect.who === 'self') rules.registersAs = { self: { ...effect.as } };
			return;
		case 'register-dead':
			if (clause.spent) rules.gameEnd = { aliveWhileDead: { untilToken: clause.spent } };
			return;
		case 'keep-ability':
			if (marks) rules.keepsAbility = { token: marks };
			return;
		case 'skip-waking':
			if (marks && effect.who === 'the-demon') rules.stopsWaking = { token: marks, type: 'demon' };
			return;
		case 'gain-ability':
			cause(rules, { kind: 'gained-ability' });
			return;
		case 'madness':
			cause(
				rules,
				effect.who === 'self'
					? { kind: 'execution', victim: { who: 'self' } }
					: { kind: 'execution' }
			);
			return;
		case 'game-rule':
			if (effect.rule === 'nominate-again') rules.nominationsAfterExecution = 1;
			if (effect.rule === 'nominate-again' || effect.rule === 'force-execution')
				cause(rules, { kind: 'execution' });
			// Carousel Demons: the Riot's nominees die.
			if (effect.rule === 'nominees-die-and-nominate') cause(rules, { kind: 'kills' });
			return;
		case 'arm':
			if (effect.on === 'nominates' && marks) rules.curses = marks;
			// What the curse sets off happens by day, so it is no night kill.
			for (const inner of effect.effects)
				applyEffect(inner, clause, type, rules, acc, false, conds, true);
			return;
		case 'later':
			for (const inner of effect.effects)
				applyEffect(inner, clause, type, rules, acc, true, [
					...(conds ?? []),
					...(effect.if ?? [])
				]);
			return;
		case 'swap':
			if (effect.what === 'character-and-alignment' && marks) {
				rules.becomes = { token: marks, into: 'swap' };
				acc.fixed.add(marks);
			}
			return;
		case 'execute': {
			const by = registers(clause.if, 'nominator')?.types?.[0];
			if (effect.who === 'self') cause(rules, { kind: 'execution', victim: { who: 'self' } });
			else if (by === 'townsfolk')
				cause(rules, { kind: 'execution', victim: { who: 'registers', as: by } });
			if (when.at === 'nominated' && effect.who === 'nominator' && by)
				rules.onNominated = { by, effect: 'execute-nominator' };
			return;
		}
		case 'end-game': {
			const count = alive(clause.if);
			const noExecution = has(clause.if, (c) => 'noExecutionToday' in c);
			const executions = clause.if?.flatMap((c) => ('executions' in c ? [c.executions] : []))[0];
			if (when.at === 'dusk' && count?.exactly !== undefined)
				acc.ends.push({ kind: 'alive-at-dusk', alive: count.exactly });
			else if (
				when.at === 'dusk' &&
				noExecution &&
				(effect.winner === 'evil' || effect.winner === 'good')
			)
				acc.ends.push({ kind: 'day-without-execution', winner: effect.winner });
			else if (when.at === 'death' && when.by === 'execution' && effect.winner === 'other-team')
				acc.ends.push({ kind: 'executed-loses' });
			else if (
				when.at === 'event' &&
				when.event === 'marked-executed' &&
				acc.firstMark &&
				(effect.winner === 'evil' || effect.winner === 'good')
			)
				acc.ends.push({ kind: 'marked-executed', token: acc.firstMark, winner: effect.winner });
			// Carousel Demons: after a numbered day (the Leviathan's day 5); after enough executions
			// of one alignment, its token marking the first of them for good.
			else if (
				when.at === 'dusk' &&
				when.day !== undefined &&
				effect.winner !== 'own-team' &&
				effect.winner !== 'other-team'
			)
				acc.ends.push({ kind: 'survives-day', day: when.day, winner: effect.winner });
			else if (executions && effect.winner !== 'own-team' && effect.winner !== 'other-team') {
				acc.ends.push({
					kind: 'executions-of-alignment',
					alignment: executions.alignment,
					count: executions.atLeast,
					winner: effect.winner
				});
				if (marks) acc.fixed.add(marks);
			}
			return;
		}
		case 'hold-game':
			if (effect.extraDay) acc.ends.push({ kind: 'extra-day' });
			if (effect.while === 'both-alive' && marks)
				acc.holds.push({ kind: 'marked-alive', token: marks });
			return;
		case 'become': {
			const count = alive(clause.if);
			if (effect.who === 'self' && effect.into === 'demon') {
				// The text counts the living before the Demon died ("5 or more players alive & the
				// Demon dies"); `aliveAtLeast` counts those left after, one fewer.
				const after = count?.atLeast && when.at === 'event' && when.event === 'demon-dies' ? 1 : 0;
				acc.holds.push({
					kind: 'becomes-demon',
					...(count?.atLeast ? { aliveAtLeast: count.atLeast - after } : {})
				});
				if (marks) {
					rules.becomes = { token: marks, into: 'demon' };
					acc.fixed.add(marks);
				}
			} else if (effect.into === 'this-character' && when.at === 'event') {
				// The Demon's death passes on: to a Minion when it kills itself (the Imp), to the
				// first Outsider it kills, once (the Fang Gu).
				if (when.event === 'killed-self') acc.holds.push({ kind: 'death-passes', to: 'minion' });
				if (when.event === 'killed-outsider')
					acc.holds.push({
						kind: 'death-passes',
						to: 'outsider',
						...(clause.spent ? { spentToken: clause.spent } : {})
					});
			}
			return;
		}
		case 'setup':
			rules.setupModifier = effect.modifier;
			return;
		case 'believe':
			if (effect.choicesAsDemon) rules.choosesLikeDemon = effect.choicesAsDemon;
			return;
		case 'boost':
			if (effect.how === 'sober-and-true' && marks)
				rules.impairs = { ...rules.impairs, clears: [marks] };
			return;
		default:
			// believe, immune, resurrect, boost, falsify-info, vote changes, storyteller notes:
			// nothing reads them yet.
			return;
	}
}
