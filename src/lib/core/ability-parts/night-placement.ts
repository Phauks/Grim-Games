/**
 * SPIKE: where a character with no night order numbers should wake, worked out from its
 * ability parts.
 *
 * TPI's night sheet runs in ordered bands, and the rule behind them is that a step goes
 * before everything it can change and after everything it reports on. On other nights:
 * Fabled, Loric and Travellers; abilities that change teams or abilities; poisoning,
 * protecting and taking abilities away; the Minions; what stops the Demon's kill; the Demon
 * kills; other kills; reactions to deaths; information, the whole night's last; then dawn
 * and announcements. The first night puts Minion info and Demon info after the changes, each
 * followed by what adds to it.
 *
 * A character's signature for one night is what its waking clauses do: when they act, what
 * the player chooses, each effect's verb and subject, what is learned, and its type. The
 * signature picks its band (`bandOf`). Inside the band, the three official characters whose
 * signatures share the most with it are its neighbours, and it goes at the middle of their
 * places; within a band, TPI's own order looks like edition order, not a rule. The reason
 * names the band and the closest neighbour. The author or the Storyteller can always move it.
 *
 * Basis: TPI's night sheet (`static/data/nightsheet.json`) and the parts in this folder. The
 * bands are our reading of the sheet: TPI publishes no night order rationale. The tests in
 * `night-placement.test.ts` count how many official characters fit their band and how far
 * each lands from its own place when it is left out.
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

/** The steps that aren't characters; they never move. */
const MARKERS = ['dusk', 'minioninfo', 'demoninfo', 'dawn'];

export type Band =
	| 'rules'
	| 'changes'
	| 'minion-info'
	| 'demon-info'
	| 'impairs'
	| 'minions'
	| 'stops-kills'
	| 'demon-kills'
	| 'kills'
	| 'reacts'
	| 'learns'
	| 'announces';

/** Each night's bands in order, with the marker steps where they sit. */
const BANDS: Record<Night, readonly string[]> = {
	firstNight: [
		'dusk',
		'rules',
		'changes',
		'minioninfo',
		'minion-info',
		'demoninfo',
		'demon-info',
		'impairs',
		'minions',
		'stops-kills',
		'demon-kills',
		'kills',
		'reacts',
		'learns',
		'dawn',
		'announces'
	],
	otherNight: [
		'dusk',
		'rules',
		'changes',
		'impairs',
		'minions',
		'stops-kills',
		'demon-kills',
		'kills',
		'reacts',
		'learns',
		'dawn',
		'announces'
	]
};

/** The band a signature wakes in on `night`; the first rule that matches wins. */
export function bandOf(signature: ReadonlySet<string>, night: Night): Band {
	const has = (...features: string[]) => features.some((f) => signature.has(f));
	const first = night === 'firstNight';
	// Told about the night's deaths: with the reactions to them (Tor).
	if (has('to:died')) return 'reacts';
	// Watches the whole night, so wakes before all of it (Wraith).
	if (has('type:fabled', 'type:loric', 'type:traveller', 'info:watches-night')) return 'rules';
	// Told to everyone once the night is over (Leviathan, Vizier).
	if (has('do:end-game') || (first && has('when:setup') && has('to:each-player')))
		return 'announces';
	// Adds to what the Minions learn (Snitch, Summoner's bluffs, Damsel, Lunatic).
	if (first && has('info:bluffs', 'to:each-minion', 'do:believe') && !has('do:gain-ability'))
		return 'minion-info';
	// Changes who is on which team or who has which ability, before anyone acts on it.
	if (
		has('do:evil-info', 'who:become-alive-neighbours') ||
		(has('do:gain-ability') && !has('when:always', 'when:death')) ||
		(first && has('type:demon') && has('do:become'))
	)
		return 'changes';
	// Adds to what the Demon learns (King).
	if (first && has('to:the-demon')) return 'demon-info';
	if (has('do:stop-kills', 'who:skip-waking-the-demon')) return 'stops-kills';
	// Sees the Grimoire: after everything it would report on (Spy).
	if (has('info:grimoire') && !has('do:impair')) return 'learns';
	if (has('type:demon') && !first && has('when:night')) return 'demon-kills';
	if (has('when:death', 'when:event') && !has('type:minion')) return 'reacts';
	if (has('who:kill-self') && has('when:always')) return 'reacts';
	if (
		has(
			'do:impair',
			'do:protect',
			'who:kill-self',
			'do:lose-ability',
			'who:become-the-demon',
			'do:register'
		)
	)
		return 'impairs';
	if (has('who:kill-chosen', 'who:kill-another-player') && !has('do:arm')) return 'kills';
	if (has('type:minion', 'do:believe')) return 'minions';
	if (has('do:resurrect', 'who:become-chosen', 'who:become-a-good-player', 'do:gain-ability'))
		return 'reacts';
	return 'learns';
}

/**
 * The band of each step of `order`: the labelling, in band order and with the markers in
 * place, that agrees with the most of its characters' own bands. Its characters whose band
 * differs from their own are the sheet's exceptions.
 */
export function sheetBands(
	order: readonly string[],
	night: Night,
	known: ReadonlyMap<string, Known>
): string[] {
	const bands = BANDS[night];
	const own = order.map((id) => {
		if (MARKERS.includes(id)) return id;
		const k = known.get(id);
		return k ? bandOf(nightSignature(k.parts, k.type, night), night) : undefined;
	});
	// best[i][j]: most agreements for the first i steps with step i in band j or before.
	const best = order.map(() => bands.map(() => 0));
	const from = order.map(() => bands.map(() => 0));
	for (const [i, label] of own.entries())
		for (const [j, band] of bands.entries()) {
			const prev = i === 0 ? null : best[i - 1];
			let top = 0;
			let at = 0;
			if (prev)
				for (let b = 0; b <= j; b++)
					if (prev[b] > top || b === 0) {
						top = prev[b];
						at = b;
					}
			const marker = MARKERS.includes(order[i]);
			best[i][j] = top + (label === band ? 1 : marker ? -order.length : 0);
			from[i][j] = at;
		}
	const out: string[] = [];
	let j = best[order.length - 1].indexOf(Math.max(...best[order.length - 1]));
	for (let i = order.length - 1; i >= 0; i--) {
		out[i] = bands[j];
		j = from[i][j];
	}
	return out;
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
	band: Band;
	/** The closest official characters in its band, best first, with what each shares. */
	near: { id: string; score: number; shared: string[] }[];
}

/**
 * Where a character wakes on `night` among `order` (TPI's night sheet, markers included):
 * in its band, at the middle of the `k` official characters there most like it. Undefined
 * if it doesn't wake.
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
	const band = bandOf(mine, night);
	const labels = sheetBands(order, night, known);
	const rank = BANDS[night].indexOf(band);
	const inBand = order.flatMap((id, index) => {
		const other = known.get(id);
		if (!other || labels[index] !== band) return [];
		const theirs = nightSignature(other.parts, other.type, night);
		const shared = [...mine].filter((f) => theirs.has(f));
		return [{ id, index, score: similarity(mine, theirs), shared }];
	});
	// No official character in its band yet: it goes where the band would start.
	if (!inBand.length) {
		const after = labels.findIndex((b) => BANDS[night].indexOf(b) > rank);
		return { index: after < 0 ? order.length : after, band, near: [] };
	}
	inBand.sort((a, b) => b.score - a.score || a.index - b.index);
	const near = inBand.slice(0, k);
	// The weighted median of the neighbours' places: one far-off neighbour doesn't drag it.
	const byPlace = [...near].sort((a, b) => a.index - b.index);
	const total = byPlace.reduce((sum, n) => sum + n.score, 0);
	let run = 0;
	const middle = byPlace.find((n) => (run += n.score) > total / 2) ?? byPlace[0];
	return {
		index: middle.index + 1,
		band,
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

/** Where each band sits, in words. */
const BAND_PHRASES: Record<Band, string> = {
	rules: 'With the Fabled, Loric and Travellers',
	changes: 'Before anyone acts, as it changes teams or abilities',
	'minion-info': 'After Minion info, as it adds to it',
	'demon-info': 'After Demon info, as it adds to it',
	impairs: 'Before the abilities it can poison, protect or take away',
	minions: 'With the Minions',
	'stops-kills': "Just before the Demon's kill, which it can stop",
	'demon-kills': 'With the Demon kills',
	kills: 'After the Demon kills',
	reacts: 'After the kills, as it reacts to deaths',
	learns: 'With the information, after everything it reports on',
	announces: 'After dawn, as it is announced'
};

/**
 * Why it goes there, such as "Before the abilities it can poison, protect or take away, near
 * the Monk, which also protects a player and chooses a player".
 */
export function placementReason(placement: Placement, nameOf: (id: string) => string): string {
	const band = BAND_PHRASES[placement.band];
	const [closest] = placement.near;
	if (!closest) return band;
	const shared = Object.keys(PHRASES)
		.filter((f) => closest.shared.includes(f))
		.map((f) => PHRASES[f]);
	const near = `${band}, near the ${nameOf(closest.id)}`;
	if (!shared.length) return near;
	const list =
		shared.length === 1
			? shared[0]
			: `${shared.slice(0, -1).join(', ')} and ${shared[shared.length - 1]}`;
	return `${near}, which also ${list}`;
}
