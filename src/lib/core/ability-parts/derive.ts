/**
 * SPIKE: compiles an ability's parts into what the app reads today: the rules keys in
 * `character-rules.ts`, whether it wakes on the first night and on other nights (TPI's night
 * sheet today), and the Sort Order phrase its text opens with (`data/sort-order.ts`).
 *
 * Only the keys below are derived; everything else in a rules block (reminder placement,
 * day reminders, night text, setup preparation) stays hand-written for now. The spike's test
 * compares each derived key with today's rules files, so every difference is either a bug in
 * the parts, a gap in today's rules, or a choice to record.
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { EndsGame, HoldsGame } from '#lib/core/data/game-end-rules.ts';
import type { CharacterType, ReminderLabel } from '#lib/core/data/types.ts';
import type { AbilityParts, Clause, Condition, Effect } from './types.ts';

/** The rules keys this compiler fills in. */
export const DERIVED_KEYS = [
	'actsWhenDead',
	'onDeath',
	'protects',
	'redirectsKill',
	'kills',
	'impairs',
	'registersAs',
	'onNominated',
	'gameEnd',
	'becomes',
	'setupModifier',
	'learns',
	'answers',
	'marksChoice',
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
	targetSeats?: Record<ReminderLabel, 'any' | 'other'>;
};

export interface Derived {
	rules: DerivedRules;
	wakes: { firstNight: boolean; otherNight: boolean };
	/** The Sort Order phrase the ability text should open with, when its timing decides it. */
	opening?: string;
}

const alive = (conditions: Condition[] | undefined) =>
	conditions?.flatMap((c) => ('alive' in c ? [c.alive] : []))[0];

const registersType = (conditions: Condition[] | undefined, who: string) =>
	conditions?.flatMap((c) => ('registers' in c && c.registers.who === who ? [c.registers] : []))[0]
		?.types?.[0];

/** Whether a clause wakes its player: on the first night, on other nights. */
function clauseWakes(clause: Clause): { first: boolean; other: boolean } {
	const { when } = clause;
	if (when.at === 'night')
		return { first: when.nights !== 'each*', other: when.nights !== 'first' };
	// Woken to act on their own death at night (the Ravenkeeper), or told they became the
	// Demon (the Scarlet Woman): a step on other nights.
	if (when.at === 'death' && when.phase === 'night' && !when.would)
		return { first: false, other: true };
	if (when.at === 'event' && when.event === 'demon-dies') return { first: false, other: true };
	return { first: false, other: false };
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
	if (when.at === 'day')
		return limit === 'once-per-game' ? 'Once per game, during the day' : 'Each day';
	if (when.at === 'nominated' && limit === 'first-time') return 'The 1st time';
	if (when.at === 'death' && !when.would && (when.phase || when.by === 'execution'))
		return 'If you die';
	return undefined;
}

export function deriveRules(parts: AbilityParts, type: CharacterType): Derived {
	const rules: DerivedRules = {};
	const fixed = new Set<ReminderLabel>();
	const marksChoice: ReminderLabel[] = [];
	const ends: EndsGame[] = [];
	const holds: HoldsGame[] = [];
	const wakes = { firstNight: false, otherNight: false };

	for (const clause of parts.clauses) {
		const { when } = clause;
		const w = clauseWakes(clause);
		wakes.firstNight ||= w.first;
		wakes.otherNight ||= w.other;
		if (clause.evenIfDead || when.at === 'death') rules.actsWhenDead = true;
		if (clause.spent) fixed.add(clause.spent);
		if (clause.marks && when.at === 'setup') fixed.add(clause.marks);
		const atNight = when.at === 'night';
		if (atNight && clause.choose && clause.marks && clause.effects.every((e) => e.do !== 'kill'))
			marksChoice.push(clause.marks);
		if (clause.choose && clause.marks)
			rules.targetSeats = {
				...rules.targetSeats,
				[clause.marks]: clause.choose.notSelf ? 'other' : 'any'
			};

		for (const effect of clause.effects)
			applyEffect(effect, clause, type, rules, { fixed, ends, holds });
	}

	if (marksChoice.length) rules.marksChoice = marksChoice;
	if (ends.length || holds.length)
		rules.gameEnd = { ...(ends.length ? { ends } : {}), ...(holds.length ? { holds } : {}) };
	if (fixed.size) rules.fixedReminders = [...fixed].sort();
	const opening = parts.clauses.filter((c) => c.when.at !== 'setup').map(clauseOpening)[0];
	return { rules, wakes, ...(opening ? { opening } : {}) };
}

function applyEffect(
	effect: Effect,
	clause: Clause,
	type: CharacterType,
	rules: DerivedRules,
	acc: { fixed: Set<ReminderLabel>; ends: EndsGame[]; holds: HoldsGame[] }
): void {
	const { when } = clause;
	switch (effect.do) {
		case 'learn': {
			const { info } = effect;
			if ('measure' in info) rules.learns = { ...info };
			else if ('question' in info) rules.answers = { ...info };
			if (when.at === 'death' && !when.would)
				// `onDeath` has no "by execution" yet; such a clause would need it (a gap).
				rules.onDeath = {
					by: when.by === 'demon' ? 'demon' : 'any',
					...(when.phase === 'night' ? { night: true } : {})
				};
			if ('measure' in info && when.at === 'night' && when.nights === 'first')
				for (const label of Object.values(info.reminders ?? {})) acc.fixed.add(label);
			return;
		}
		case 'protect': {
			// A protection from the Demon is a night one already, so `night` adds nothing.
			const night =
				effect.until === 'tonight' && effect.from !== 'demon' ? { night: true as const } : {};
			if (effect.who === 'self' || effect.who === 'a-good-player')
				rules.protects = { who: 'self', from: effect.from, ...night };
			else if (effect.who === 'chosen' && clause.marks)
				rules.protects = { who: 'marked', token: clause.marks, from: effect.from, ...night };
			return;
		}
		case 'redirect-death':
			if (when.at === 'death') rules.redirectsKill = { from: when.by ?? 'any' };
			return;
		case 'kill': {
			const as = registersType(clause.if, effect.who);
			rules.deathCause =
				effect.who === 'self'
					? { kind: 'own-death' }
					: as === 'demon'
						? { kind: 'kills', victim: { who: 'registers', as } }
						: { kind: 'kills' };
			// `kills` is the night step's kill; a day kill (the Slayer's shot) is a death cause.
			if (when.at !== 'night') return;
			rules.kills = {
				by: type === 'demon' ? 'demon' : 'other',
				...(effect.who === 'self' ? { targets: 'self' as const } : {}),
				...(effect.ignoresProtection ? { ignoresProtection: true } : {})
			};
			return;
		}
		case 'impair':
			if (effect.who === 'self') rules.impairs = { ...rules.impairs, self: { reason: effect.as } };
			else if (clause.marks)
				rules.impairs = {
					...rules.impairs,
					tokens: { ...rules.impairs?.tokens, [clause.marks]: { reason: effect.as, on: 'carrier' } }
				};
			return;
		case 'register':
			if (effect.who === 'self') rules.registersAs = { self: { ...effect.as } };
			return;
		case 'execute': {
			const by = registersType(clause.if, 'nominator');
			if (effect.who === 'self') rules.deathCause = { kind: 'execution', victim: { who: 'self' } };
			else if (by === 'townsfolk')
				rules.deathCause = { kind: 'execution', victim: { who: 'registers', as: by } };
			if (when.at === 'nominated' && effect.who === 'nominator' && by)
				rules.onNominated = { by, effect: 'execute-nominator' };
			return;
		}
		case 'end-game': {
			const count = alive(clause.if);
			if (when.at === 'dusk' && count?.exactly !== undefined)
				acc.ends.push({ kind: 'alive-at-dusk', alive: count.exactly });
			else if (when.at === 'death' && when.by === 'execution' && effect.winner === 'other-team')
				acc.ends.push({ kind: 'executed-loses' });
			return;
		}
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
				if (clause.marks) {
					rules.becomes = { token: clause.marks, into: 'demon' };
					acc.fixed.add(clause.marks);
				}
			} else if (effect.who === 'a-minion' && when.at === 'event' && when.event === 'killed-self')
				acc.holds.push({ kind: 'death-passes', to: 'minion' });
			return;
		}
		case 'setup':
			rules.setupModifier = effect.modifier;
			return;
		default:
			// believe, immune, vote changes, storyteller notes: nothing reads them yet.
			return;
	}
}
