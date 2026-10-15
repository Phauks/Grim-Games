/**
 * Rules terms from the BotC wiki Glossary (https://wiki.bloodontheclocktower.com/Glossary)
 * that appear in the game text the app shows: ability text, TPI's Storyteller night text
 * and our pre-day reminders. A test checks every term here occurs in that text.
 *
 * No definitions are kept here: Trevor (2026-10-15) wants the wiki's own wording only, and
 * the wiki has no content licence, so its text is never bundled. The popover links to the
 * entry and may show the wiki text fetched live on the device (glossary/wiki-glossary.ts).
 * Each term links to the Glossary page. Its entries have no HTML
 * anchors, so the link uses a text fragment (`#:~:text=Term:`), which browsers that
 * support it scroll to and others ignore.
 *
 * Character type names (Demon, Townsfolk, ...) and everyday words (ability, player,
 * Storyteller) are left out on purpose: marking them would underline most sentences.
 * "May" is not a Glossary term (only "Might" is), so it is not marked.
 */

export const GLOSSARY_URL = 'https://wiki.bloodontheclocktower.com/Glossary';

export interface GlossaryTerm {
	id: string;
	/** The entry's name on the wiki Glossary page. */
	term: string;
	/** Words in game text that mean this term, lower case. `term` is matched too. */
	variants: readonly string[];
	/** The Glossary page, scrolled to the entry where the browser supports it. */
	url: string;
}

/** A text fragment link to a Glossary entry: `-`, `&` and `,` must be escaped there. */
export function glossaryEntryUrl(term: string): string {
	const fragment = encodeURIComponent(`${term}:`).replace(/-/g, '%2D');
	return `${GLOSSARY_URL}#:~:text=${fragment}`;
}

type Entry = Omit<GlossaryTerm, 'url'>;

const ENTRIES: readonly Entry[] = [
	{
		id: 'poisoned',
		term: 'Poisoned',
		variants: ['poison', 'poisons', 'poisoning']
	},
	{
		id: 'healthy',
		term: 'Healthy',
		variants: []
	},
	{
		id: 'drunk',
		term: 'Drunk',
		variants: ['drunkenness']
	},
	{
		id: 'sober',
		term: 'Sober',
		variants: []
	},
	{
		id: 'mad',
		term: 'Mad',
		variants: ['madness']
	},
	{
		id: 'might',
		term: 'Might',
		variants: []
	},
	{
		id: 'register',
		term: 'Register',
		variants: ['registers', 'registered', 'registering']
	},
	{
		id: 'alive-neighbors',
		term: 'Alive neighbours',
		variants: [
			'alive neighbors',
			'alive neighbor',
			'alive neighbour',
			'living neighbors',
			'living neighbours'
		]
	},
	{
		id: 'neighbors',
		term: 'Neighbors',
		variants: ['neighbor', 'neighbours', 'neighbour', 'neighboring', 'neighbouring']
	},
	{
		id: 'in-play',
		term: 'In play',
		variants: ['in-play']
	},
	{
		id: 'not-in-play',
		term: 'Not in play',
		variants: ['not-in-play']
	},
	{
		id: 'start-knowing',
		term: 'Start knowing',
		variants: ['starts knowing']
	},
	{
		id: 'each-night-star',
		term: 'Each night*',
		variants: []
	},
	{
		id: 'once-per-game',
		term: 'Once per game',
		variants: []
	},
	{
		id: 'choose',
		term: 'Choose',
		variants: ['chooses', 'chose', 'chosen']
	},
	{
		id: 'alive',
		term: 'Alive',
		variants: []
	},
	{
		id: 'dead',
		term: 'Dead',
		variants: []
	},
	{
		id: 'execution',
		term: 'Execution',
		variants: ['executions', 'execute', 'executes', 'executed', 'executee']
	},
	{
		id: 'exile',
		term: 'Exile',
		variants: ['exiles', 'exiled']
	},
	{
		id: 'nomination',
		term: 'Nomination',
		variants: ['nominations', 'nominate', 'nominates', 'nominated', 'nominating', 'nominee']
	},
	{
		id: 'vote',
		term: 'Vote',
		variants: ['votes', 'voted', 'voting', 'voter', 'voters']
	},
	{
		id: 'public',
		term: 'Public',
		variants: ['publicly']
	},
	{
		id: 'private',
		term: 'Private',
		variants: ['privately']
	},
	{
		id: 'think',
		term: 'Think',
		variants: ['thinks']
	},
	{
		id: 'dawn',
		term: 'Dawn',
		variants: []
	},
	{
		id: 'dusk',
		term: 'Dusk',
		variants: []
	},
	{
		id: 'resurrected',
		term: 'Resurrected',
		variants: ['resurrect', 'resurrects', 'regurgitated', 'reborn']
	},
	{
		id: 'tomorrow',
		term: 'Tomorrow',
		variants: []
	},
	{
		id: 'false-info',
		term: 'False info',
		variants: []
	},
	{
		id: 'true-info',
		term: 'True info',
		variants: []
	},
	{
		id: 'alignment',
		term: 'Alignment',
		variants: ['alignments']
	},
	{
		id: 'info-token',
		term: 'Info token',
		variants: ['info tokens']
	},
	{
		id: 'reminder-token',
		term: 'Reminder token',
		variants: ['reminder tokens']
	},
	{
		id: 'grimoire',
		term: 'Grimoire',
		variants: []
	}
];

export const GLOSSARY: readonly GlossaryTerm[] = ENTRIES.map((entry) => ({
	...entry,
	url: glossaryEntryUrl(entry.term)
}));

export type GlossarySegment =
	{ kind: 'text'; text: string } | { kind: 'term'; text: string; term: GlossaryTerm };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every spelling, longest first, so "not in play" wins over "in play". */
const SPELLINGS = new Map<string, GlossaryTerm>();
for (const term of GLOSSARY) {
	for (const spelling of [term.term, ...term.variants]) SPELLINGS.set(spelling.toLowerCase(), term);
}
const ORDERED = [...SPELLINGS.keys()].sort((a, b) => b.length - a.length);
// Whole words only: no letter, digit, apostrophe or hyphen on either side.
const PATTERN = new RegExp(
	`(?<![\\p{L}\\p{N}_'’-])(?:${ORDERED.map(escape).join('|')})(?![\\p{L}\\p{N}_-])`,
	'giu'
);

const NAME_PATTERNS = new Map<string, RegExp>();
function namePattern(name: string): RegExp {
	let re = NAME_PATTERNS.get(name);
	if (!re) {
		re = new RegExp(`(?<![\\p{L}\\p{N}_'’-])${escape(name)}(?![\\p{L}\\p{N}_-])`, 'gu');
		NAME_PATTERNS.set(name, re);
	}
	return re;
}

export interface GlossaryOptions {
	/**
	 * Names that are never marked (character names: "the Drunk" is a character, not the
	 * drunk state). Matched whole-word and case-sensitively.
	 */
	exclude?: readonly string[];
	/**
	 * Terms already marked earlier in the same block. Each term is marked at its first use
	 * only; pass the same set for every piece of one block. Updated in place.
	 */
	seen?: Set<string>;
}

/**
 * Splits text into plain runs and Glossary terms. Matching is case-insensitive and on
 * whole words; each term is marked the first time it appears (per `seen`), and matches
 * never overlap.
 */
export function glossarySegments(text: string, options: GlossaryOptions = {}): GlossarySegment[] {
	const seen = options.seen ?? new Set<string>();
	const blocked: [number, number][] = [];
	for (const name of options.exclude ?? []) {
		// A cheap substring test first: most blocks name no character.
		if (!name || !text.includes(name)) continue;
		for (const m of text.matchAll(namePattern(name))) {
			blocked.push([m.index, m.index + m[0].length]);
		}
	}

	const out: GlossarySegment[] = [];
	let at = 0;
	for (const match of text.matchAll(PATTERN)) {
		const start = match.index;
		const end = start + match[0].length;
		if (blocked.some(([a, b]) => start < b && end > a)) continue;
		const term = SPELLINGS.get(match[0].toLowerCase());
		if (!term || seen.has(term.id)) continue;
		seen.add(term.id);
		if (start > at) out.push({ kind: 'text', text: text.slice(at, start) });
		out.push({ kind: 'term', text: match[0], term });
		at = end;
	}
	if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
	return out;
}

/**
 * Marks the pieces of one block (text split around tokens or badges) together, so each
 * term is marked at its first use in the whole block.
 */
export function glossaryBlock(
	texts: readonly string[],
	options: Omit<GlossaryOptions, 'seen'> = {}
): GlossarySegment[][] {
	const seen = new Set<string>();
	return texts.map((text) => glossarySegments(text, { ...options, seen }));
}
