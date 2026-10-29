/**
 * The night's ordered bands, and which band a character wakes in (L74, Trevor 2026-10-29).
 *
 * TPI's night sheet runs in ordered bands, and the rule behind them is that a step goes
 * before everything it can change and after everything it reports on. On other nights:
 * Fabled and Loric; what watches the night; Travellers; abilities that change teams or
 * abilities; poisoning, protecting and taking abilities away; the Minions; what stops the
 * Demon's kill; the Demon kills; other kills; reactions to deaths; information, whatever
 * reports on the whole night last; then dawn and announcements. The first night sets up the
 * teams before the Travellers, and puts Minion info and Demon info after the changes, each
 * followed by what adds to it.
 *
 * A character's signature (`signature.ts`) is a set of features such as `do:protect`,
 * `choose:player` or `type:minion`; `bandOf` picks its band from them. Basis: TPI's night
 * sheet (`static/data/nightsheet.json`). The bands are our reading of it: TPI publishes no
 * night order rationale; `bands.test.ts` counts how many official characters fit.
 */

export type Night = 'firstNight' | 'otherNight';

/** A character's signature by id, or undefined when it isn't known. */
export type SignatureOf = (id: string) => ReadonlySet<string> | undefined;

/** The steps that aren't characters; they never move. */
export const MARKERS = ['dusk', 'minioninfo', 'demoninfo', 'dawn'];

export type Band =
	| 'rules'
	| 'watches'
	| 'team-setup'
	| 'travellers'
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
export const BANDS: Record<Night, readonly string[]> = {
	firstNight: [
		'dusk',
		'rules',
		'watches',
		'team-setup',
		'travellers',
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
		'watches',
		'travellers',
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
	// Skips evil's first-night info, so it goes before it (Tor).
	if (has('rule:skip-evil-info')) return 'changes';
	if (has('type:fabled', 'type:loric')) return 'rules';
	// Watches the whole night, so wakes before all of it (Wraith).
	if (has('info:watches-night')) return 'watches';
	// Sets up who the Minions are before anyone wakes (Lord of Typhon, Kazali).
	if (first && has('type:demon') && has('do:become')) return 'team-setup';
	if (has('type:traveller')) return 'travellers';
	// Told to everyone once the night is over (Leviathan, Vizier).
	if (has('do:end-game') || (first && has('when:setup') && has('to:each-player')))
		return 'announces';
	// Adds to what the Minions learn (Snitch, Summoner's bluffs, Damsel, the Lunatic as Demon).
	if (first && has('info:bluffs', 'to:each-minion', 'believe:demon') && !has('do:gain-ability'))
		return 'minion-info';
	// Changes who is on which team or who has which ability, before anyone acts on it.
	if (
		has('do:evil-info', 'who:become-alive-neighbours') ||
		(has('do:gain-ability') && !has('when:always', 'when:death'))
	)
		return 'changes';
	// Adds to what the Demon learns (King).
	if (first && has('to:the-demon')) return 'demon-info';
	// Rewrites the rules before anyone else acts (the Wizard's wish).
	if (has('do:storyteller') && has('type:minion') && !has('do:become')) return 'impairs';
	// Learns after a death it waited for: with the information, after what it reports on
	// (Bounty Hunter).
	if (has('when:event') && has('do:later') && has('do:learn')) return 'learns';
	// Learns now and may take on an ability later: with those that may change (Pixie).
	if (first && has('later:gain-ability') && has('do:learn')) return 'reacts';
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
	signatureOf: SignatureOf
): string[] {
	const bands = BANDS[night];
	const own = order.map((id) => {
		if (MARKERS.includes(id)) return id;
		const signature = signatureOf(id);
		return signature?.size ? bandOf(signature, night) : undefined;
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
