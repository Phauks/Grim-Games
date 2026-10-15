/**
 * Rules terms from the BotC wiki Glossary (https://wiki.bloodontheclocktower.com/Glossary)
 * that appear in the game text the app shows: ability text, TPI's Storyteller night text
 * and our pre-day reminders. A test checks every term here occurs in that text.
 *
 * The definitions are our own short summaries; the wiki has no content licence, so never
 * paste its wording here. Each term links to the Glossary page. Its entries have no HTML
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
	/** Our own 1–2 sentence summary in plain words. */
	definition: string;
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
		variants: ['poison', 'poisons', 'poisoning'],
		definition:
			'The player has no ability but is not told, often because of an evil ability. The Storyteller acts as if it works, and its information may be wrong.'
	},
	{
		id: 'healthy',
		term: 'Healthy',
		variants: [],
		definition: 'Not poisoned.'
	},
	{
		id: 'drunk',
		term: 'Drunk',
		variants: ['drunkenness'],
		definition:
			'The player has no ability but thinks they have it. The Storyteller acts as if it works, and its information may be wrong.'
	},
	{
		id: 'sober',
		term: 'Sober',
		variants: [],
		definition: 'Not drunk.'
	},
	{
		id: 'mad',
		term: 'Mad',
		variants: ['madness'],
		definition:
			'The player must try to convince the group that something is true. The Storyteller judges whether they tried hard enough.'
	},
	{
		id: 'might',
		term: 'Might',
		variants: [],
		definition:
			'The Storyteller decides whether it happens. It is a choice, not a rule that always applies.'
	},
	{
		id: 'register',
		term: 'Register',
		variants: ['registers', 'registered', 'registering'],
		definition:
			'Counts as a different character or alignment for other abilities, without gaining that ability. The Storyteller decides each time.'
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
		],
		definition: 'The nearest living player on each side, skipping over dead players in between.'
	},
	{
		id: 'neighbors',
		term: 'Neighbors',
		variants: ['neighbor', 'neighbours', 'neighbour', 'neighboring', 'neighbouring'],
		definition: 'The two players sitting directly either side, whether alive or dead.'
	},
	{
		id: 'in-play',
		term: 'In play',
		variants: ['in-play'],
		definition: 'A character some player has in this game, alive or dead.'
	},
	{
		id: 'not-in-play',
		term: 'Not in play',
		variants: ['not-in-play'],
		definition: 'A character on the script that no player has in this game.'
	},
	{
		id: 'start-knowing',
		term: 'Start knowing',
		variants: ['starts knowing'],
		definition:
			'Learned on the first night, or on the night the player becomes this character later on.'
	},
	{
		id: 'each-night-star',
		term: 'Each night*',
		variants: [],
		definition: 'Every night except the first one.'
	},
	{
		id: 'once-per-game',
		term: 'Once per game',
		variants: [],
		definition: 'Usable one time only. A use while drunk or poisoned still counts as the one use.'
	},
	{
		id: 'choose',
		term: 'Choose',
		variants: ['chooses', 'chose', 'chosen'],
		definition: 'The player makes the choice, not the Storyteller.'
	},
	{
		id: 'alive',
		term: 'Alive',
		variants: [],
		definition: 'Not dead: the player has their ability, can nominate and can vote freely.'
	},
	{
		id: 'dead',
		term: 'Dead',
		variants: [],
		definition:
			'The player loses their ability and cannot nominate, and has one vote left for the rest of the game.'
	},
	{
		id: 'execution',
		term: 'Execution',
		variants: ['executions', 'execute', 'executes', 'executed', 'executee'],
		definition:
			'The town’s vote to kill a player during the day. There is at most one execution a day.'
	},
	{
		id: 'exile',
		term: 'Exile',
		variants: ['exiles', 'exiled'],
		definition: 'The group’s choice to remove a Traveller during the day. It is not an execution.'
	},
	{
		id: 'nomination',
		term: 'Nomination',
		variants: ['nominations', 'nominate', 'nominates', 'nominated', 'nominating', 'nominee'],
		definition: 'Calling for a vote on whether to execute a player.'
	},
	{
		id: 'vote',
		term: 'Vote',
		variants: ['votes', 'voted', 'voting', 'voter', 'voters'],
		definition:
			'Raising a hand while the votes on a nomination are counted. A player may vote on several nominations in a day.'
	},
	{
		id: 'public',
		term: 'Public',
		variants: ['publicly'],
		definition: 'Something most players, and the Storyteller, know about.'
	},
	{
		id: 'private',
		term: 'Private',
		variants: ['privately'],
		definition: 'Said only to the people involved, where the rest of the group cannot hear.'
	},
	{
		id: 'think',
		term: 'Think',
		variants: ['thinks'],
		definition: 'The player believes they are a different character from the one they really are.'
	},
	{
		id: 'dawn',
		term: 'Dawn',
		variants: [],
		definition: 'The end of the night. Abilities that act at dawn go after everyone else.'
	},
	{
		id: 'dusk',
		term: 'Dusk',
		variants: [],
		definition: 'The start of the night. Abilities that act at dusk go before everyone else.'
	},
	{
		id: 'resurrected',
		term: 'Resurrected',
		variants: ['resurrect', 'resurrects', 'regurgitated', 'reborn'],
		definition: 'A dead player comes back to life and gets their ability back.'
	},
	{
		id: 'tomorrow',
		term: 'Tomorrow',
		variants: [],
		definition: 'The day after the current night, and the night after that day.'
	},
	{
		id: 'false-info',
		term: 'False info',
		variants: [],
		definition:
			'Information that is wrong, usually because the player is drunk or poisoned. The Storyteller chooses it.'
	},
	{
		id: 'true-info',
		term: 'True info',
		variants: [],
		definition:
			'Information that is correct. Answers about the rules are always true, whatever a player’s state.'
	},
	{
		id: 'alignment',
		term: 'Alignment',
		variants: ['alignments'],
		definition: 'Which team a player is on right now: good or evil. It can change during a game.'
	},
	{
		id: 'info-token',
		term: 'Info token',
		variants: ['info tokens'],
		definition: 'A rectangular card the Storyteller shows a player at night to tell them something.'
	},
	{
		id: 'reminder-token',
		term: 'Reminder token',
		variants: ['reminder tokens'],
		definition:
			'A small token in the Grimoire that tracks what a character has done or who it affects.'
	},
	{
		id: 'grimoire',
		term: 'Grimoire',
		variants: [],
		definition: 'The Storyteller’s board, which shows the true state of the game to them only.'
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
		if (!name) continue;
		const re = new RegExp(`(?<![\\p{L}\\p{N}_'’-])${escape(name)}(?![\\p{L}\\p{N}_-])`, 'gu');
		for (const m of text.matchAll(re)) blocked.push([m.index, m.index + m[0].length]);
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
