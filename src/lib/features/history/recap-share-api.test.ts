import { describe, expect, it } from 'vitest';
import type { GameRecap } from './recap-html.ts';
import {
	parseRecapApiPath,
	readCreatedRecap,
	readSharedRecap,
	recapPagePath,
	sharedRecap
} from './recap-share-api.ts';

const recap: GameRecap = {
	title: 'Trouble Brewing',
	played: '19 Oct 2026',
	result: 'Evil won',
	days: 2,
	seats: [
		{ seatId: 'a', number: 1, name: 'Ana', end: { name: 'Imp', alignment: 'evil' }, dead: false }
	],
	log: [{ time: '8:42 PM', text: 'Ana (Imp) was nominated' }],
	notes: [{ about: 'Ana', text: 'Bluffed Chef' }]
};

const ID = 'AbC_-123456789abcdefgh';

describe('sharedRecap', () => {
	it('never carries a part the Storyteller left out', () => {
		const shared = sharedRecap(
			recap,
			{ log: true, image: false, notes: false },
			'data:image/jpeg;base64,AAAA'
		);
		expect(shared.recap.notes).toEqual([]);
		expect(shared.recap.log).toHaveLength(1);
		expect(shared.image).toBeUndefined();
		expect(JSON.stringify(shared)).not.toContain('Bluffed');
	});

	it('keeps the picture only as image data', () => {
		const parts = { log: true, image: true, notes: true };
		expect(sharedRecap(recap, parts, 'data:image/jpeg;base64,AAAA').image).toBe(
			'data:image/jpeg;base64,AAAA'
		);
		expect(sharedRecap(recap, parts, 'https://example.com/a.png').image).toBeUndefined();
	});
});

describe('readSharedRecap', () => {
	const good = sharedRecap(recap, { log: true, image: true, notes: false });

	it('reads what sharedRecap made', () => {
		expect(readSharedRecap(JSON.parse(JSON.stringify(good)))).toEqual(good);
	});

	it('refuses anything that is not a recap this build can lay out', () => {
		expect(readSharedRecap(undefined)).toBeUndefined();
		expect(readSharedRecap({ ...good, v: 2 })).toBeUndefined();
		expect(readSharedRecap({ ...good, recap: { ...recap, title: 5 } })).toBeUndefined();
		expect(
			readSharedRecap({ ...good, recap: { ...recap, seats: [{ ...recap.seats[0], dead: 'no' }] } })
		).toBeUndefined();
		expect(readSharedRecap({ ...good, image: 'javascript:alert(1)' })).toBeUndefined();
		expect(readSharedRecap({ ...good, parts: { log: true } })).toBeUndefined();
	});
});

describe('recap paths', () => {
	it('takes only a 128-bit id from the path', () => {
		expect(parseRecapApiPath(`/api/recap/${ID}`)).toBe(ID);
		expect(parseRecapApiPath('/api/recap/482913')).toBeUndefined();
		expect(parseRecapApiPath(`/api/recap/${ID}/x`)).toBeUndefined();
		expect(recapPagePath(ID)).toBe(`/recap/${ID}`);
	});

	it('reads the created id and key', () => {
		expect(readCreatedRecap({ id: ID, deleteKey: 'k' })).toEqual({ id: ID, deleteKey: 'k' });
		expect(readCreatedRecap({ id: '1', deleteKey: 'k' })).toBeUndefined();
	});
});
