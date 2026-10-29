/**
 * Where a character with no night order of its own should wake, and why (L74, Trevor
 * 2026-10-29): its band (`bands.ts`), then the official characters in that band most like it.
 * The reason names the band and the closest neighbour; the Storyteller can always move it.
 */
import { BANDS, bandOf, sheetBands, type Band, type Night, type SignatureOf } from './bands.ts';

/** How much a shared feature counts; the rest count 1. */
const WEIGHT: Record<string, number> = { type: 6, do: 3, who: 2 };
const weightOf = (feature: string) => WEIGHT[feature.split(':')[0]] ?? 1;

/** Weighted Jaccard similarity of two signatures, 0 to 1. */
function similarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
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
 * Where a character with signature `mine` wakes on `night` among `order` (TPI's night sheet,
 * markers included): in its band, at the middle of the `k` official characters there most
 * like it (their places within a band look like edition order, not a rule). Undefined for
 * an empty signature.
 */
export function recommendPlacement(
	mine: ReadonlySet<string>,
	night: Night,
	order: readonly string[],
	signatureOf: SignatureOf,
	k = 3
): Placement | undefined {
	if (!mine.size) return undefined;
	const band = bandOf(mine, night);
	const labels = sheetBands(order, night, signatureOf);
	const rank = BANDS[night].indexOf(band);
	const inBand = order.flatMap((id, index) => {
		const theirs = signatureOf(id);
		if (!theirs?.size || labels[index] !== band) return [];
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
	'who:kill-chosen': 'kills a chosen player',
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
	rules: 'With the Fabled and Loric',
	watches: 'Before everything it watches',
	'team-setup': 'Before anyone wakes, as it sets up the teams',
	travellers: 'With the Travellers',
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
