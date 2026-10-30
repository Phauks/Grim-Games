import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { newGame, run, testContext } from '#lib/core/model/fixtures.test-support.ts';
import { lateSeatCounts, proposeLateSeat } from './late-seat-proposal.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);
const TB = [
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor',
	'butler',
	'drunk',
	'recluse',
	'saint',
	'poisoner',
	'spy',
	'scarletwoman',
	'baron',
	'imp'
].map((id) => data.byId.get(id)!);

function mulberry32(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A game whose bag holds `tiles` (in order), with the first `drawn` of them drawn. */
function draw(tiles: string[], drawn: number) {
	const names = tiles.map((_, i) => `P${i + 1}`);
	const { session, ctx, seats } = newGame(names, { ctx: testContext() });
	let s = run(session, ctx, {
		type: 'BuildBag',
		tiles: tiles.map((id) => ({ shows: id, grimoire: id })),
		includeTravellers: false,
		shuffle: false
	});
	const order = s.game.bag!.order;
	for (let i = 0; i < drawn; i++) {
		s = run(
			s,
			ctx,
			{ type: 'DrawTile', seatId: seats[i], tileId: order[i] },
			{ type: 'ConfirmDraw', tileId: order[i] }
		);
	}
	return s.game;
}

// Twelve players: 7 Townsfolk, 2 Outsiders, 2 Minions and the Demon. Thirteen is 9, 0, 3, 1
// (https://wiki.bloodontheclocktower.com/Setup), so both Outsiders have to go.
const TWELVE = [
	'washerwoman',
	'imp',
	'recluse',
	'chef',
	'poisoner',
	'empath',
	'monk',
	'saint',
	'spy',
	'soldier',
	'mayor',
	'slayer'
];

const propose = (game: ReturnType<typeof draw>, seed: number, ruleCharacters: string[] = []) =>
	proposeLateSeat({
		game,
		scriptCharacters: TB,
		lookup,
		ruleCharacters,
		random: mulberry32(seed)
	});

// The fair late seat (Trevor, 2026-10-30): a late player joins as one more player instead of
// as a Traveller (https://wiki.bloodontheclocktower.com/Travellers).
describe('proposeLateSeat', () => {
	it('suggests a 12 to 13 change whose tiles add up to the counts for 13', () => {
		for (const drawn of [0, 6, 12]) {
			for (let seed = 1; seed <= 40; seed++) {
				const game = draw(TWELVE, drawn);
				const p = propose(game, seed);
				expect(p.before).toEqual({ townsfolk: 7, outsider: 2, minion: 2, demon: 1 });
				expect(p.after).toEqual({ townsfolk: 9, outsider: 0, minion: 3, demon: 1 });
				expect(lateSeatCounts(game, lookup, p.changes, p.bag)).toEqual(p.tileTarget);
				expect(p.bag).toHaveLength(13 - drawn);
				// The Demon never moves.
				expect(p.changes.map((c) => c.from)).not.toContain('imp');
			}
		}
	});

	it('picks new characters that are on the script and not already in play', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const game = draw(TWELVE, 12);
			const p = propose(game, seed);
			const kept = new Set(TWELVE.filter((id) => !p.changes.some((c) => c.from === id)));
			for (const id of [...p.changes.map((c) => c.to), ...p.bag]) {
				expect(TB.map((c) => c.id)).toContain(id);
				expect(kept.has(id) && !p.bag.includes(id)).toBe(false);
				// Setup changers and characters with no tile of their own are the Storyteller's.
				expect(['baron', 'drunk']).not.toContain(id);
			}
		}
	});

	it('lets the Sentinel keep an Outsider, and sometimes does', () => {
		const outsiders = new Set<number>();
		for (let seed = 1; seed <= 40; seed++) {
			const game = draw(TWELVE, 12);
			const p = propose(game, seed, ['sentinel']);
			outsiders.add(p.after.outsider);
			expect(lateSeatCounts(game, lookup, p.changes, p.bag)).toEqual(p.tileTarget);
		}
		expect([...outsiders].sort()).toEqual([0, 1]);
	});

	it('keeps a Baron in play, and counts the Outsiders he adds', () => {
		// Ten players with the Baron: 5, 2, 2, 1. Eleven is 7, 1, 2, 1, so with him 5, 3, 2, 1
		// (https://wiki.bloodontheclocktower.com/Baron).
		const TEN = [
			'chef',
			'baron',
			'saint',
			'empath',
			'imp',
			'recluse',
			'monk',
			'soldier',
			'mayor',
			'poisoner'
		];
		for (let seed = 1; seed <= 40; seed++) {
			const game = draw(TEN, 10);
			const p = propose(game, seed);
			expect(p.after).toEqual({ townsfolk: 5, outsider: 3, minion: 2, demon: 1 });
			// He may be moved back into the bag, but never out of play.
			expect(p.outOfPlay).not.toContain('baron');
			const changed = p.changes.some((c) => c.from === 'baron');
			expect(!changed || p.bag.includes('baron')).toBe(true);
			expect(lateSeatCounts(game, lookup, p.changes, p.bag)).toEqual(p.tileTarget);
		}
	});
});
