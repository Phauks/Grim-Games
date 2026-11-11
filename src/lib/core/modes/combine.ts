/**
 * One game mode with any number of special rules on top (Trevor, 2026-10-18: rules stack,
 * modes don't mix). Lists join, count changes add up, steps run in order (the mode's, then
 * each rule's in the order chosen), and a part only one file can set becomes a conflict when
 * two set it differently. Conflicts are warnings: the Storyteller can start anyway.
 * Design: /mnt/project-files/world-cup-rules/format-design.md.
 */
import type {
	CombinedSetup,
	ForcedRule,
	GameMode,
	ModeSetup,
	Restrictions,
	SpecialRule
} from './types.ts';

/** Two files that can't sensibly be played together, and the part they disagree on. */
export interface RuleConflict {
	/** The mode's or rule's ids, the earlier one first. */
	ids: [string, string];
	/**
	 * The part both set differently, or `rules.<part>` for a part of both rules blocks; absent
	 * when a rule lists the other in `conflictsWith`.
	 */
	part?: keyof CombinedSetup | `rules.${string}`;
}

export interface Combined {
	setup: CombinedSetup;
	conflicts: RuleConflict[];
}

/**
 * Parts with one answer per game: a second, different answer is a conflict. The whole-game
 * setup are here too (Trevor, 2026-11-01), though only a game mode sets them (`fileKind`).
 */
const SINGLE = [
	'pool',
	'counts',
	'assignment',
	'towns',
	'betweenGames',
	'setupModifiers',
	'duplicates',
	'bluffs',
	'winConditions',
	'participants',
	'travellers',
	'seats',
	'deaths'
] as const satisfies readonly (keyof CombinedSetup)[];

/** Parts that are lists: every file's items, in order. */
const LISTS = [
	'ruleChanges',
	'information',
	'daySteps',
	'text'
] as const satisfies readonly (keyof CombinedSetup)[];

export function combineRules(mode: GameMode, rules: readonly SpecialRule[]): Combined {
	const setup: CombinedSetup = { ...mode.setup };
	const conflicts: RuleConflict[] = [];
	// Who set each single-answer part, for naming a conflict.
	const setBy = new Map<keyof CombinedSetup, string>();
	for (const key of SINGLE)
		if (mode.setup[key as keyof ModeSetup] !== undefined) setBy.set(key, mode.id);

	for (const rule of rules) {
		const add: CombinedSetup = rule.setup;
		for (const key of SINGLE) {
			const value = add[key];
			if (value === undefined) continue;
			const current = setup[key];
			// A mode's pool of plain script is the standard one, which a rule's pool may add to.
			const standard = key === 'pool' && setup.pool?.kind === 'script';
			if (current === undefined || standard) {
				Object.assign(setup, { [key]: value });
				setBy.set(key, rule.id);
			} else if (!same(current, value)) {
				conflicts.push({ ids: [setBy.get(key) ?? mode.id, rule.id], part: key });
			}
		}
		for (const key of LISTS) {
			const items = add[key];
			if (items?.length) Object.assign(setup, { [key]: [...(setup[key] ?? []), ...items] });
		}
		if (add.restricted) setup.restricted = joinRestrictions(setup.restricted, add.restricted);
		if (add.forced) setup.forced = joinForced(setup.forced, add.forced);
	}

	// Rules blocks stay each file's own (a rule source each, `rules/rule-sources.ts`), but two that set
	// one part differently can't both have their way.
	const ruleSetBy = new Map<string, { id: string; value: unknown }>();
	for (const file of [mode, ...rules])
		for (const [key, value] of Object.entries(file.rules ?? {})) {
			const earlier = ruleSetBy.get(key);
			if (!earlier) ruleSetBy.set(key, { id: file.id, value });
			else if (!same(earlier.value, value))
				conflicts.push({ ids: [earlier.id, file.id], part: `rules.${key}` });
		}

	const chosen = [mode, ...rules];
	for (const file of chosen) {
		const listed = [...(file.conflictsWith?.modes ?? []), ...(file.conflictsWith?.rules ?? [])];
		for (const other of chosen) {
			if (other === file || !listed.includes(other.id)) continue;
			const ids: [string, string] =
				chosen.indexOf(other) < chosen.indexOf(file) ? [other.id, file.id] : [file.id, other.id];
			if (!conflicts.some((c) => !c.part && c.ids[0] === ids[0] && c.ids[1] === ids[1]))
				conflicts.push({ ids });
		}
	}
	return { setup, conflicts };
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

/** The mode as the game plays it: its setup with the rules folded in (conflicts aside). */
export function withRules(
	mode: GameMode,
	rules: readonly SpecialRule[]
): GameMode & { setup: CombinedSetup } {
	return rules.length ? { ...mode, setup: combineRules(mode, rules).setup } : mode;
}
