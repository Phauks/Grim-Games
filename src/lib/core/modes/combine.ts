/**
 * One game mode with any number of special rules on top (Trevor, 2026-10-18: rules stack,
 * modes don't mix). Lists join, count changes add up, steps run in order (the mode's, then
 * each rule's in the order chosen), and a part only one file can set becomes a conflict when
 * two set it differently. Conflicts are warnings: the Storyteller can start anyway.
 * Design: /mnt/project-files/world-cup-rules/format-design.md.
 */
import type {
	CombinedParts,
	ForcedRule,
	GameMode,
	ModeParts,
	Restrictions,
	RuleParts,
	SpecialRule
} from './types.ts';

/** Two files that can't sensibly be played together, and the part they disagree on. */
export interface RuleConflict {
	/** The mode's or rule's ids, the earlier one first. */
	ids: [string, string];
	/** The part both set differently; absent when a rule lists the other in `conflictsWith`. */
	part?: keyof CombinedParts;
}

export interface Combined {
	parts: CombinedParts;
	conflicts: RuleConflict[];
}

/** Parts with one answer per game: a second, different answer is a conflict. */
const SINGLE = [
	'pool',
	'setupModifiers',
	'duplicates',
	'bluffs',
	'winConditions',
	'participants',
	'travellers',
	'seats',
	'deaths'
] as const satisfies readonly (keyof CombinedParts)[];

/** Parts that are lists: every file's items, in order. */
const LISTS = [
	'ruleChanges',
	'information',
	'daySteps',
	'nightSteps',
	'text',
	'countChanges'
] as const satisfies readonly (keyof CombinedParts)[];

export function combineRules(mode: GameMode, rules: readonly SpecialRule[]): Combined {
	const parts: CombinedParts = { ...mode.parts };
	const conflicts: RuleConflict[] = [];
	// Who set each single-answer part, for naming a conflict.
	const setBy = new Map<keyof CombinedParts, string>();
	for (const key of SINGLE)
		if (mode.parts[key as keyof ModeParts] !== undefined) setBy.set(key, mode.id);

	for (const rule of rules) {
		const add: RuleParts = rule.parts;
		for (const key of SINGLE) {
			const value = add[key];
			if (value === undefined) continue;
			const current = parts[key];
			// A mode's pool of plain script is the standard one, which a rule's pool may add to.
			const standard = key === 'pool' && parts.pool?.kind === 'script';
			if (current === undefined || standard) {
				Object.assign(parts, { [key]: value });
				setBy.set(key, rule.id);
			} else if (!same(current, value)) {
				conflicts.push({ ids: [setBy.get(key) ?? mode.id, rule.id], part: key });
			}
		}
		for (const key of LISTS) {
			const items = add[key];
			if (items?.length) Object.assign(parts, { [key]: [...(parts[key] ?? []), ...items] });
		}
		if (add.restricted) parts.restricted = joinRestrictions(parts.restricted, add.restricted);
		if (add.forced) parts.forced = joinForced(parts.forced, add.forced);
	}

	const chosen = [mode, ...rules];
	for (const rule of rules) {
		const listed = [...(rule.conflictsWith?.modes ?? []), ...(rule.conflictsWith?.rules ?? [])];
		for (const other of chosen) {
			if (other === rule || !listed.includes(other.id)) continue;
			const ids: [string, string] =
				chosen.indexOf(other) < chosen.indexOf(rule) ? [other.id, rule.id] : [rule.id, other.id];
			if (!conflicts.some((c) => !c.part && c.ids[0] === ids[0] && c.ids[1] === ids[1]))
				conflicts.push({ ids });
		}
	}
	return { parts, conflicts };
}

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

const union = <T>(a: readonly T[] | undefined, b: readonly T[] | undefined): T[] | undefined =>
	a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined;

function joinRestrictions(a: Restrictions | undefined, b: Restrictions): Restrictions {
	if (!a) return b;
	const onlyFor = [...(a.onlyFor ?? []), ...(b.onlyFor ?? [])].filter(
		(o, i, all) => all.findIndex((x) => x.characterId === o.characterId) === i
	);
	return {
		...a,
		banned: union(a.banned, b.banned) ?? [],
		...(a.notChoosable || b.notChoosable
			? { notChoosable: union(a.notChoosable, b.notChoosable) }
			: {}),
		...(a.onlyFor || b.onlyFor ? { onlyFor } : {})
	};
}

function joinForced(a: ForcedRule | undefined, b: ForcedRule): ForcedRule {
	if (!a) return b;
	const homebrew = [...(a.homebrew ?? []), ...(b.homebrew ?? [])].filter(
		(h, i, all) => all.findIndex((x) => x.url === h.url) === i
	);
	return {
		...a,
		inPlay: union(a.inPlay, b.inPlay) ?? [],
		...(a.onScript || b.onScript ? { onScript: union(a.onScript, b.onScript) } : {}),
		...(a.ruleCharacters || b.ruleCharacters
			? { ruleCharacters: union(a.ruleCharacters, b.ruleCharacters) }
			: {}),
		...(a.homebrew || b.homebrew ? { homebrew } : {})
	};
}

/** The mode as the game plays it: its parts with the rules folded in (conflicts aside). */
export function withRules(mode: GameMode, rules: readonly SpecialRule[]): GameMode {
	return rules.length ? { ...mode, parts: combineRules(mode, rules).parts } : mode;
}
