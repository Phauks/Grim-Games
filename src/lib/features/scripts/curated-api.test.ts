import { describe, expect, it } from 'vitest';
import { mergeCurated, readCuratedList, type CuratedScript } from './curated-api.ts';

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
