import { describe, expect, it } from 'vitest';
import { idsIn, ROADMAP, roadmapStatus, type RoadmapArea } from './roadmap.ts';
import type { Change } from './changelog.ts';

const change = (sha: string, subject: string, pr?: number): Change => ({
	sha,
	subject,
	date: '2026-10-22',
	...(pr ? { pr } : {})
});

describe('roadmap', () => {
	it('reads the IDs a title names in brackets', () => {
		expect(idsIn('Savant info generator (L2)')).toEqual(['L2']);
		expect(idsIn('Night step header (L8, L18a)')).toEqual(['L8', 'L18a']);
		expect(idsIn('Share sheet (L20 + L7 + L19)')).toEqual(['L20', 'L7', 'L19']);
		expect(idsIn('Print on A4 or Letter (Carousel)')).toEqual([]);
		expect(idsIn('L2 without brackets')).toEqual([]);
	});

	it('ticks an item off by its ID in a title or by a listed PR, naming the first change', () => {
		const areas: RoadmapArea[] = [
			{
				title: 'Area',
				items: [
					{ id: 'L2', title: 'By ID' },
					{ id: 'S1', title: 'By PR', prs: [320] },
					{ id: 'B1', title: 'Not yet' }
				]
			}
		];
		const [area] = roadmapStatus(areas, [
			change('c', 'Savant follow-up (L2)', 340),
			change('b', 'Install app', 320),
			change('a', 'Savant info generator (L2)', 319)
		]);
		expect(area.items.map((item) => item.doneBy?.pr)).toEqual([319, 320, undefined]);
	});

	it('gives every item its own ID in the plan format', () => {
		const ids = ROADMAP.flatMap((area) => area.items.map((item) => item.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(idsIn(`(${id})`)).toEqual([id]);
	});
});
