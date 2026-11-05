import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB, parseLab } from './lab-store.svelte.ts';

// A newer build reads what an older one saved (src/service-worker.ts keeps old builds running).
describe('parseLab', () => {
	it('reads an M37 save: its first locked character is the core one, the rest is dropped', () => {
		const old = {
			playerCount: 9,
			locked: ['philosopher', 'tealady'],
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
			core: 'philosopher',
			filler: 'tb',
			index: 2,
			gameId: 'g1'
		});
	});

	it('starts with no core character, and reads a saved one', () => {
		expect(parseLab({ locked: [] }).core).toBeUndefined();
		expect(parseLab({ core: 'summoner' }).core).toBe('summoner');
	});

	it('keeps the switches, and falls back to the defaults for anything unreadable', () => {
		const saved = parseLab({ jinxedOnly: false, setupTokens: false, pickJinxed: true });
		expect(saved).toMatchObject({ setupTokens: false, pickJinxed: true });
		expect(saved).not.toHaveProperty('jinxedOnly');
		expect(parseLab('nonsense')).toEqual(DEFAULT_LAB);
	});
});
