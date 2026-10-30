import { describe, expect, it } from 'vitest';
import {
	idsIn,
	PART_PRS,
	ROADMAP,
	roadmapByArea,
	roadmapStatus,
	type RoadmapItem
} from './roadmap.ts';
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

	it('marks a feature done once every part and PR has merged, naming the last one', () => {
		const items: RoadmapItem[] = [
			{ title: 'By ID and PR', area: 'player', parts: ['L2', 'S1'], prs: [330] },
			{ title: 'Partly', area: 'player', parts: ['L2', 'B1'] },
			{ title: 'Someday', area: 'storyteller', parts: ['A1'], later: true }
		];
		const { done, next, later } = roadmapStatus(
			items,
			[
				change('d', 'Savant follow-up (L2)', 340),
				change('c', 'Ratings', 330),
				change('b', 'Install app', 320),
				change('a', 'Savant info generator (L2)', 319)
			],
			{ S1: 320 }
		);
		expect(done.map((item) => [item.title, item.doneBy?.pr])).toEqual([['By ID and PR', 330]]);
		expect(next.map((item) => [item.title, item.finished, item.total])).toEqual([['Partly', 1, 2]]);
		expect(later.map((item) => item.title)).toEqual(['Someday']);
	});

	it('groups features by area in the page order, unfinished first, then later, then done', () => {
		const items: RoadmapItem[] = [
			{ title: 'Shipped', area: 'player', parts: ['L2'] },
			{ title: 'Someday', area: 'player', parts: ['A1'], later: true },
			{ title: 'Soon', area: 'player', parts: ['B1'] },
			{ title: 'Board', area: 'storyteller', parts: ['B2'] }
		];
		const areas = roadmapByArea(roadmapStatus(items, [change('a', 'Savant (L2)', 1)], {}));
		expect(areas.map(({ area, items, done }) => [area, items.map((i) => i.title), done])).toEqual([
			['storyteller', ['Board'], 0],
			['player', ['Soon', 'Someday', 'Shipped'], 1]
		]);
	});

	it('names each plan ID in one feature only, in the plan format', () => {
		const ids = ROADMAP.flatMap((item) => item.parts ?? []);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of [...ids, ...Object.keys(PART_PRS)]) expect(idsIn(`(${id})`)).toEqual([id]);
		for (const id of Object.keys(PART_PRS)) expect(ids).toContain(id);
	});
});
