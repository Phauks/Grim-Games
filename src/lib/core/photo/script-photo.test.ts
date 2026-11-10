import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript, loadScript } from '#lib/core/data/script.ts';
import {
	bylineAuthor,
	photoScriptJson,
	likeness,
	plainText,
	readScriptLines,
	titleOf,
	type PhotoLine,
	type PhotoLineTrace
} from './script-photo.ts';

const data = committedGameData();
const official = data.characters.filter((c) => c.edition);
const tb = editionScript('tb', data)!;

/** A sheet as a reader returns it: the title, then each character's name and ability on one line. */
function sheet(
	title: string,
	rows: readonly { name: string; ability: string }[],
	typo: (name: string) => string = (n) => n
): PhotoLine[] {
	return [
		{ text: title, height: 40 },
		{ text: 'Townsfolk', height: 14 },
		...rows.map((r) => ({ text: `${typo(r.name)} ${r.ability}`, height: 12 }))
	];
}

describe('plainText and likeness', () => {
	it('forgives case, accents, punctuation and spaces', () => {
		expect(plainText('Fortune-Teller’s')).toBe('fortune tellers');
		expect(plainText('Pit-Hag')).toBe('pit hag');
		expect(likeness(plainText('Raven keeper'), plainText('Ravenkeeper'))).toBe(1);
	});
});

describe('readScriptLines', () => {
	it('reads every character of a clean Trouble Brewing sheet', () => {
		const reading = readScriptLines(sheet('Trouble Brewing', tb.characters), official);
		expect(reading.found.map((f) => f.character.id)).toEqual(tb.characters.map((c) => c.id));
		expect(reading.found.every((f) => f.kind === 'matched')).toBe(true);
		expect(reading.title).toBe('Trouble Brewing');
		expect(reading.unmatched).toEqual([]);
	});

	it('finds misread names by their ability text', () => {
		// Reader slips: 1 for l, rn for m, dropped letters.
		const slip = (n: string) => n.replace(/l/g, '1').replace(/m/g, 'rn').slice(0, -1);
		const reading = readScriptLines(sheet('Troub1e Brewing', tb.characters, slip), official);
		expect(new Set(reading.found.map((f) => f.character.id))).toEqual(
			new Set(tb.characters.map((c) => c.id))
		);
	});

	it('marks a close name with no readable ability for the user to check', () => {
		const reading = readScriptLines([{ text: 'Ravenkeepr' }, { text: 'Washerwornan' }], official);
		expect(reading.found.map((f) => [f.character.id, f.kind])).toEqual([
			['ravenkeeper', 'matched'],
			['washerwoman', 'close']
		]);
	});

	it('names on lines of their own, with the ability on the next line', () => {
		const lines = tb.characters.flatMap((c) => [{ text: c.name }, { text: c.ability }]);
		const reading = readScriptLines(lines, official);
		expect(reading.found.map((f) => f.character.id)).toEqual(tb.characters.map((c) => c.id));
	});

	it('keeps a name it does not know as unmatched, and never a type heading', () => {
		const reading = readScriptLines(
			[
				{ text: 'My Homebrew Script', height: 30 },
				{ text: 'Outsiders' },
				{ text: 'Lamplighter' },
				{ text: 'Chef' }
			],
			official
		);
		expect(reading.found.map((f) => f.character.id)).toEqual(['chef']);
		expect(reading.unmatched).toEqual(['Lamplighter']);
		expect(reading.title).toBe('My Homebrew Script');
	});

	it('skips noise and blank lines', () => {
		const reading = readScriptLines(
			[
				{ text: '' },
				{ text: '~ . ,' },
				{ text: '*Not the first night' },
				// An ability's last word on a line of its own, one letter from Poisoner.
				{ text: 'poisoned.' }
			],
			official
		);
		expect(reading.found).toEqual([]);
		expect(reading.unmatched).toEqual([]);
	});
});

describe('the import log', () => {
	it('tells how each line was read: by name, by ability, close, unmatched or the title', () => {
		const chef = official.find((c) => c.id === 'chef')!;
		const lines: PhotoLine[] = [
			{ text: 'Storm Front', height: 40 },
			{ text: 'Empath', height: 12 },
			{ text: chef.ability, height: 12 },
			{ text: 'Invstgatr', height: 12 },
			{ text: 'Zorblax Quint', height: 12 },
			{ text: '', height: 12 }
		];
		const traces: PhotoLineTrace[] = [];
		readScriptLines(lines, official, (t) => traces.push(t));
		expect(traces.map((t) => t.outcome)).toEqual([
			'title',
			'name',
			'ability',
			'close',
			'unmatched',
			'empty'
		]);
		expect(traces[1]).toMatchObject({ name: 'Empath', score: 1 });
		expect(traces[2]).toMatchObject({ name: 'Chef' });
		expect(traces[3]).toMatchObject({ name: 'Investigator' });
		const missed = traces[4];
		expect(missed.outcome === 'unmatched' && missed.nearest?.score).toBeLessThan(0.7);
	});
});

describe('the script a review makes', () => {
	it("keeps a custom character from the user's own scripts, with its ability", () => {
		const own = loadScript(
			[
				{ id: '_meta', name: 'Mine' },
				{ id: 'bard', name: 'Bard', team: 'townsfolk', ability: 'You start knowing a secret song.' }
			],
			data
		).script!;
		const bard = own.characters[0];
		const chef = official.find((c) => c.id === 'chef')!;
		const loaded = loadScript(photoScriptJson('Storm Front', [chef, bard]), data);
		expect(loaded.problems.filter((p) => p.severity === 'error')).toEqual([]);
		expect(loaded.script?.name).toBe('Storm Front');
		expect(loaded.script?.characters.map((c) => [c.name, c.ability])).toEqual([
			['Chef', chef.ability],
			['Bard', 'You start knowing a secret song.']
		]);
	});
});

describe('the author', () => {
	it('is read from a "By:" line under the title, which is never the title or a character', () => {
		// Trevor, 2026-11-06: "By: XXX should recognize as the author".
		const lines: PhotoLine[] = [
			{ text: 'Storm Front', height: 40 },
			{ text: 'By: Trevor Goldsmith', height: 14 },
			{ text: 'Empath', height: 12 },
			{ text: 'Chef', height: 12 }
		];
		const traces: PhotoLineTrace[] = [];
		const reading = readScriptLines(lines, official, (t) => traces.push(t));
		expect(reading.author).toBe('Trevor Goldsmith');
		expect(reading.title).toBe('Storm Front');
		expect(reading.unmatched).toEqual([]);
		expect(traces[1]).toMatchObject({ outcome: 'author', author: 'Trevor Goldsmith' });
		const script = loadScript(
			photoScriptJson(
				reading.title,
				reading.found.map((f) => f.character),
				reading.author
			),
			data
		).script;
		expect(script?.meta.author).toBe('Trevor Goldsmith');
	});

	it('reads "By name" and "by: name." but not an ability that starts with "By"', () => {
		expect(bylineAuthor('By Steven Medway')).toBe('Steven Medway');
		expect(bylineAuthor('by: Jams.')).toBe('Jams');
		expect(bylineAuthor('BY - Lau')).toBe('Lau');
		expect(
			bylineAuthor('By day, you may choose a player to learn whether they are good or evil')
		).toBe(undefined);
		expect(bylineAuthor('Bystander')).toBe(undefined);
	});

	it('is empty when the sheet has no byline', () => {
		expect(readScriptLines([{ text: 'Empath' }], official).author).toBe('');
	});
});

describe('the title', () => {
	it('is kept apart from a printed rule and a type heading on its line', () => {
		// Trevor's Kingfishing sheet (2026-11-10): the title sits on a rule that runs to a
		// "TOWNSFOLK" pill, read as dashes and a few stray letters.
		expect(titleOf('—Kingfishing———————————————— (ww')).toBe('Kingfishing');
		expect(titleOf('Kingfishing ———————— TOWNSFOLK')).toBe('Kingfishing');
		expect(titleOf('Trouble Brewing')).toBe('Trouble Brewing');
		expect(titleOf("Tom's Script!")).toBe("Tom's Script!");
	});
});
