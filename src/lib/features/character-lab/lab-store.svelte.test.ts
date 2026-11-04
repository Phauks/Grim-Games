import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB, parseLab } from './lab-store.svelte.ts';

// A newer build reads what an older one saved (src/service-worker.ts keeps old builds running).
describe('parseLab', () => {
	it('reads an M37 save: its Jinxes source is the jinx filter, its marks are dropped', () => {
		const old = {
			playerCount: 9,
			locked: ['philosopher'],
			source: { kind: 'jinxes' },
			place: 'bluff',
			filler: 'tb',
			index: 2,
			gameId: 'g1',
			marks: { 'philosopher+bountyhunter': 'works' }
		};
		expect(parseLab(old)).toEqual({
			...DEFAULT_LAB,
			playerCount: 9,
			locked: ['philosopher'],
			jinxedOnly: true,
			place: 'bluff',
			filler: 'tb',
			index: 2,
			gameId: 'g1'
		});
	});

	it('turns the jinx filter off for an M37 save that listed a type or hand-picked', () => {
		expect(parseLab({ source: { kind: 'type', type: 'demon' } }).jinxedOnly).toBe(false);
		expect(parseLab({ source: { kind: 'picked', ids: ['chef'] } }).jinxedOnly).toBe(false);
	});

	it('keeps the M45 switches, and falls back to the defaults for anything unreadable', () => {
		const saved = parseLab({ jinxedOnly: false, setupTokens: false, pickJinxed: true });
		expect(saved).toMatchObject({ jinxedOnly: false, setupTokens: false, pickJinxed: true });
		expect(parseLab('nonsense')).toEqual(DEFAULT_LAB);
	});
});
