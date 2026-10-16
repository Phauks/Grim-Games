/**
 * Rules terms marked in game text: https://wiki.bloodontheclocktower.com/Glossary
 * (the fixture holds the page's entry names only; no wiki prose is kept).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { DAY_REMINDER_ENTRIES } from './day-reminders.data.ts';
import fixture from './fixtures/wiki-glossary-entries.json' with { type: 'json' };
import { GLOSSARY, GLOSSARY_URL, glossarySegments, type GlossarySegment } from './glossary.ts';

const data = committedGameData();
const names = data.characters.map((c) => c.name);

/** Everything the app shows that the glossary marks: ability, night and jinx text, day reminders. */
const blocks: string[] = [
	...data.characters.flatMap((c) => [
		c.ability,
		c.firstNightReminder ?? '',
		c.otherNightReminder ?? ''
	]),
	...data.jinxes.all.map((j) => j.reason),
	...DAY_REMINDER_ENTRIES.flatMap((e) =>
		e.reminders.flatMap((r) => r.template.flatMap((s) => ('text' in s ? [s.text] : [])))
	),
	// The automatic line for an impairable character (describe.ts).
	'is poisoned',
	'is drunk'
].filter(Boolean);

const terms = (segments: GlossarySegment[]) =>
	segments.flatMap((s) => (s.kind === 'term' ? [s.term.id] : []));

describe('glossary terms', () => {
	it('has unique ids and spellings', () => {
		const ids = GLOSSARY.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		const spellings = GLOSSARY.flatMap((t) => [t.term, ...t.variants].map((s) => s.toLowerCase()));
		expect(new Set(spellings).size).toBe(spellings.length);
	});

	it('every term occurs in some official game text', () => {
		const found = new Set(
			blocks.flatMap((text) => terms(glossarySegments(text, { exclude: names })))
		);
		const missing = GLOSSARY.filter((t) => !found.has(t.id)).map((t) => t.term);
		// Fabled is a character type the app shows, though no game text names it.
		expect(missing).toEqual(['Fabled']);
	});

	it('links each term to its entry on the wiki Glossary page', () => {
		expect(fixture.page).toBe(GLOSSARY_URL);
		for (const term of GLOSSARY) {
			expect(fixture.entries).toContain(term.term);
			const url = new URL(term.url);
			expect(`${url.origin}${url.pathname}`).toBe(GLOSSARY_URL);
			expect(decodeURIComponent(url.hash)).toBe(`#:~:text=${term.term}:`);
		}
	});

	it('keeps no definitions of our own (Trevor: wiki wording only)', () => {
		for (const term of GLOSSARY) expect(Object.keys(term), term.term).not.toContain('definition');
	});
});

describe('glossarySegments', () => {
	it('marks whole words only, ignoring case', () => {
		const text = 'Each night, choose a player: they are Poisoned tonight.';
		const segments = glossarySegments(text);
		expect(terms(segments)).toEqual(['each-night', 'choose', 'player', 'poisoned']);
		expect(segments.map((s) => s.text).join('')).toBe(text);
		expect(terms(glossarySegments('The Poisoner is deadly; the mad hatter made it.'))).toEqual([
			'mad'
		]);
	});

	it('marks each term at its first use only', () => {
		const segments = glossarySegments('poisoned and drunk, then poisoned and drunk again');
		expect(terms(segments)).toEqual(['poisoned', 'drunk']);
		const seen = new Set<string>();
		expect(terms(glossarySegments('they are drunk', { seen }))).toEqual(['drunk']);
		expect(terms(glossarySegments('still drunk', { seen }))).toEqual([]);
	});

	it('prefers the longest term and never overlaps', () => {
		expect(terms(glossarySegments('a not-in-play character and an in play one'))).toEqual([
			'not-in-play',
			'character',
			'in-play'
		]);
		expect(terms(glossarySegments('the character token of a character'))).toEqual([
			'character-token',
			'character'
		]);
		expect(terms(glossarySegments('your 2 alive neighbors'))).toEqual(['alive-neighbors']);
		expect(terms(glossarySegments('Each night*, you learn'))).toEqual(['each-night-star']);
		for (const text of blocks) {
			const segments = glossarySegments(text, { exclude: names });
			expect(segments.map((s) => s.text).join('')).toBe(text);
			const marked = segments.filter((s) => s.kind === 'term');
			expect(new Set(marked.map((s) => s.term.id)).size).toBe(marked.length);
		}
	});

	it('marks character types, the Demon and alignments', () => {
		expect(
			terms(glossarySegments('A Townsfolk, Outsiders, a Minion and Demons (except Travellers)'))
		).toEqual(['townsfolk', 'outsider', 'minion', 'demon', 'traveller']);
		expect(terms(glossarySegments('One Fabled is in play'))).toEqual(['fabled', 'in-play']);
		expect(terms(glossarySegments('2 players that are not the Demon'))).toEqual([
			'player',
			'the-demon'
		]);
		expect(terms(glossarySegments('1 good & 1 evil character token: good wins'))).toEqual([
			'good',
			'evil-character',
			'win'
		]);
	});

	it('does not mark character names', () => {
		const drunk = data.byId.get('drunk')!;
		expect(terms(glossarySegments(drunk.ability, { exclude: names }))).not.toContain('drunk');
		expect(terms(glossarySegments('The Drunk is drunk.', { exclude: ['Drunk'] }))).toEqual([
			'drunk'
		]);
	});
});
