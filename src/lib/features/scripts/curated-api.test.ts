import { describe, expect, it } from 'vitest';
import {
	addTaggedMonths,
	mergeCurated,
	readCuratedList,
	readTaggedMonths,
	type CuratedScript
} from './curated-api.ts';

const script = (section: string, link: string, extra: Partial<CuratedScript> = {}) => ({
	section,
	link,
	json: [{ id: '_meta', name: link }],
	...extra
});

describe('mergeCurated', () => {
	it('keeps each Script of the Month once the page moves on, newest first', () => {
		const september = mergeCurated(
			[],
			[script('month', 'a'), script('recommended', 'r')],
			'2026-09'
		);
		expect(september).toEqual([
			script('month', 'a', { seen: '2026-09' }),
			script('recommended', 'r')
		]);
		const october = mergeCurated(
			september,
			[script('month', 'b'), script('recommended', 'r')],
			'2026-10'
		);
		const november = mergeCurated(
			october,
			[script('month', 'c'), script('recommended', 'r')],
			'2026-11'
		);
		expect(november).toEqual([
			script('month', 'c', { seen: '2026-11' }),
			script('recommended', 'r'),
			script('month', 'b', { seen: '2026-10', past: true }),
			script('month', 'a', { seen: '2026-09', past: true })
		]);
	});

	it('keeps the month a script was first seen while it stays listed', () => {
		const first = mergeCurated([], [script('month', 'a')], '2026-09');
		expect(mergeCurated(first, [script('month', 'a')], '2026-10')).toEqual([
			script('month', 'a', { seen: '2026-09' })
		]);
	});

	it('only past Scripts of the Month are kept, not dropped recommendations', () => {
		const before = mergeCurated([], [script('recommended', 'r')], '2026-09');
		expect(mergeCurated(before, [], '2026-10')).toEqual([]);
	});
});

it('reads back the month and past marks', () => {
	const list = [script('month', 'a', { seen: '2026-09', past: true })];
	expect(readCuratedList({ scripts: list })).toEqual(list);
});

describe('BotC Scripts tagged months', () => {
	// Shape of botcscripts.com/api/scripts/?tags=27 (VersionSerializer rows).
	const page = {
		count: 2,
		next: null,
		results: [
			{
				pk: 9,
				script_id: 42,
				name: 'Tagged',
				version: '5.1.0',
				content: [{ id: '_meta', name: 'Tagged' }]
			},
			{ pk: 8, script_id: 7, name: 'Bad', version: '1.0.0', content: { id: 'not a list' } }
		]
	};
	const tagged = script('month', 'https://botcscripts.com/script/42/5.1.0', {
		json: [{ id: '_meta', name: 'Tagged' }],
		past: true,
		botc: { scriptId: 42, version: '5.1.0' }
	});

	it('reads each tagged script as a past month with its BotC Scripts page', () => {
		expect(readTaggedMonths(page)).toEqual([tagged]);
		expect(readTaggedMonths({ detail: 'Not found.' })).toBeUndefined();
	});

	it('lists them after our own months, skipping one we already have by name', () => {
		const own = script('month', 'tpi', {
			seen: '2026-10',
			json: [{ id: '_meta', name: 'tagged ' }]
		});
		const other = { ...tagged, link: 'x', json: [{ id: '_meta', name: 'Other' }] };
		expect(addTaggedMonths([own], [tagged, other])).toEqual([own, other]);
	});

	it('keeps the tagged ones we had when the site does not answer', () => {
		const own = script('month', 'tpi', { seen: '2026-10' });
		expect(addTaggedMonths([own, tagged], undefined)).toEqual([own, tagged]);
		expect(addTaggedMonths([own, tagged], [])).toEqual([own]);
	});

	it('reads back the BotC Scripts reference', () => {
		expect(readCuratedList({ scripts: [tagged] })).toEqual([tagged]);
	});
});
