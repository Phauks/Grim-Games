/**
 * SPIKE: where a character with no night order numbers should wake, worked out from its
 * ability parts.
 *
 * A character's signature for one night is what its waking clauses do: when they act, what
 * the player chooses, each effect's verb and subject, what is learned, and the character
 * type. The signature puts it in a stage of the night (it changes characters, impairs,
 * protects, is a Minion or Demon, reacts to a death, learns). Among the official characters
 * in the same stage, the three whose signatures share the most with it are its neighbours;
 * it goes at the middle of their places in TPI's night sheet, and the reason names the
 * closest one and what they share. The author or the Storyteller can always move it.
 *
 * Basis: TPI's night sheet (`static/data/nightsheet.json`) and the parts in this folder. The
 * leave-one-out test in `night-placement.test.ts` measures how close each official character
 * lands to its own place when it is left out.
 */
import type { CharacterType } from '#lib/core/data/types.ts';
import { allEffects, clauseWakes } from './derive.ts';
import type { AbilityParts, Clause, Effect } from './types.ts';

export type Night = 'firstNight' | 'otherNight';

/** One official character the recommender learns from. */
export interface Known {
	parts: AbilityParts;
	type: CharacterType;
}

/** How much a shared feature counts; the rest count 1. */
const WEIGHT: Record<string, number> = { type: 6, do: 3, who: 2 };
const weightOf = (feature: string) => WEIGHT[feature.split(':')[0]] ?? 1;

/**
 * The stages of a night, each with the features that put a character in it; the first match
 * wins. TPI's night sheet runs roughly in this order, but the stages overlap there, so a stage
 * only narrows who the neighbours are.
 */
const STAGES: { stage: Stage; has: string[] }[] = [
	{
		stage: 'changes',
		has: ['do:become', 'do:swap', 'do:gain-ability', 'do:lose-ability', 'do:believe']
	},
	{ stage: 'impairs', has: ['do:impair', 'do:skip-waking', 'do:falsify-info', 'do:madness'] },
	{ stage: 'protects', has: ['do:protect'] },
	{ stage: 'demon', has: ['type:demon'] },
	{ stage: 'minion', has: ['type:minion'] },
	{ stage: 'reacts', has: ['when:death', 'when:event'] },
	{ stage: 'learns', has: ['do:learn'] }
];
export type Stage =
	'changes' | 'impairs' | 'protects' | 'demon' | 'minion' | 'reacts' | 'learns' | 'other';

export function stageOf(signature: ReadonlySet<string>): Stage {
	return STAGES.find((s) => s.has.some((f) => signature.has(f)))?.stage ?? 'other';
}

function wakesOn(clause: Clause, night: Night): boolean {
	const w = clauseWakes(clause);
	return night === 'firstNight' ? w.first : w.other;
}

function infoFeature(effect: Effect & { do: 'learn' }): string {
	const info = effect.info;
	if ('measure' in info) return `info:${info.measure}`;
	if ('question' in info) return `info:${info.question}`;
	return `info:${info.kind}`;
}

function effectFeatures(effect: Effect): string[] {
	const out = [`do:${effect.do}`];
	if ('who' in effect && typeof effect.who === 'string') out.push(`who:${effect.do}-${effect.who}`);
	if (effect.do === 'impair') out.push(`impair:${effect.as}`);
	if (effect.do === 'learn') out.push(infoFeature(effect));
	if (effect.do === 'learn' && effect.to) out.push(`to:${effect.to}`);
	return out;
}

/** What a character's clauses that wake it on `night` do, as features; empty if it doesn't wake. */
export function nightSignature(
	parts: AbilityParts,
	type: CharacterType,
	night: Night
): Set<string> {
	const out = new Set<string>();
	for (const clause of parts.clauses) {
		if (!wakesOn(clause, night)) continue;
		const { when } = clause;
		out.add(`when:${when.at}`);
		if (when.at === 'night') out.add(`nights:${when.nights}`);
		if (when.at === 'event') out.add(`event:${when.event}`);
		if (when.at === 'death' && when.by) out.add(`death:${when.by}`);
		if (clause.choose) {
			out.add(`choose:${clause.choose.what}`);
			out.add(`count:${clause.choose.countOf ?? clause.choose.count}`);
		}
		if (clause.limit) out.add(`limit:${clause.limit}`);
		if (clause.optional) out.add('optional');
		if (clause.evenIfDead) out.add('evenIfDead');
		if (clause.marks) out.add('marks');
		for (const effect of allEffects(clause.effects))
			for (const f of effectFeatures(effect)) out.add(f);
	}
	if (out.size) out.add(`type:${type}`);
	return out;
}

/** Weighted Jaccard similarity of two signatures, 0 to 1. */
function similarity(a: Set<string>, b: Set<string>): number {
	let shared = 0;
	let all = 0;
	for (const f of new Set([...a, ...b])) {
		const w = weightOf(f);
		all += w;
		if (a.has(f) && b.has(f)) shared += w;
	}
	return all ? shared / all : 0;
}

export interface Placement {
	/** Where to insert it in `order` (before the step now at this index). */
	index: number;
	stage: Stage;
	/** The closest official characters, best first, with what each shares with it. */
	near: { id: string; score: number; shared: string[] }[];
}

/**
 * Where a character wakes on `night` among `order` (TPI's night sheet, markers included),
 * from the `k` official characters in `known` most like it. Undefined if it doesn't wake.
 */
export function recommendPlacement(
	parts: AbilityParts,
	type: CharacterType,
	night: Night,
	order: readonly string[],
	known: ReadonlyMap<string, Known>,
	k = 3
): Placement | undefined {
	const mine = nightSignature(parts, type, night);
	if (!mine.size) return undefined;
	const stage = stageOf(mine);
	const all = order.flatMap((id, index) => {
		const other = known.get(id);
		if (!other) return [];
		const theirs = nightSignature(other.parts, other.type, night);
		if (!theirs.size) return [];
		const shared = [...mine].filter((f) => theirs.has(f));
		return [
			{ id, index, score: similarity(mine, theirs), shared, same: stageOf(theirs) === stage }
		];
	});
	// Neighbours from its own stage; any official character when it is the first of its stage.
	const scored = all.some((n) => n.same) ? all.filter((n) => n.same) : all;
	scored.sort((a, b) => b.score - a.score || a.index - b.index);
	const near = scored.slice(0, k);
	if (!near.length) return undefined;
	// The weighted median of the neighbours' places: one far-off neighbour doesn't drag it.
	const byPlace = [...near].sort((a, b) => a.index - b.index);
	const total = byPlace.reduce((sum, n) => sum + n.score, 0);
	let run = 0;
	const middle = byPlace.find((n) => (run += n.score) >= total / 2) ?? byPlace[0];
	return {
		index: middle.index + 1,
		stage,
		near: near.map(({ id, score, shared }) => ({ id, score, shared }))
	};
}

/** Plain words for the features a reason names; the rest are left out of it. */
const PHRASES: Record<string, string> = {
	'do:protect': 'protects a player',
	'do:kill': 'kills',
	'do:impair': 'poisons or makes drunk',
	'do:learn': 'learns something',
	'do:become': 'changes character',
	'do:swap': 'swaps characters',
	'do:gain-ability': 'gains an ability',
	'do:lose-ability': 'takes an ability away',
	'do:skip-waking': 'stops a player waking',
	'do:madness': 'makes a player mad',
	'when:death': 'acts on a death',
	'when:event': 'acts after something happens',
	'choose:player': 'chooses a player',
	'choose:character': 'chooses a character',
	evenIfDead: 'acts even if dead'
};

/** Why it goes there, such as "Near the Monk, which also protects a player and chooses a player". */
export function placementReason(placement: Placement, nameOf: (id: string) => string): string {
	const [closest] = placement.near;
	const shared = Object.keys(PHRASES)
		.filter((f) => closest.shared.includes(f))
		.map((f) => PHRASES[f]);
	const near = `Near the ${nameOf(closest.id)}`;
	if (!shared.length) return near;
	const list =
		shared.length === 1
			? shared[0]
			: `${shared.slice(0, -1).join(', ')} and ${shared[shared.length - 1]}`;
	return `${near}, which also ${list}`;
}
