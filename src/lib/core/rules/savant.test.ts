/**
 * Savant information worked out from the grimoire. Each scenario paraphrases the rules as
 * the wiki states them:
 * - https://wiki.bloodontheclocktower.com/Savant (one true and one false each day; drunk or
 *   poisoned may hear two of a kind)
 * - https://wiki.bloodontheclocktower.com/Vortox (a sober Savant hears two false statements)
 * - https://wiki.bloodontheclocktower.com/Recluse (might register as evil and as a Minion or Demon)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	castGame,
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import {
	partnerTruth,
	pickStatement,
	savantPair,
	savantSituation,
	savantStatements,
	type SavantStatement
} from './savant.ts';
import { dawnGames } from '#lib/core/engine/index.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

/** A seeded generator, so picks are repeatable. */
function seeded(seed = 7) {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) % 2 ** 31;
		return x / 2 ** 31;
	};
}

const cast = ['savant', 'chef', 'empath', 'butler', 'poisoner', 'imp', 'monk'];
const byKey = (all: SavantStatement[], key: string) => all.find((s) => s.key === key);

describe('Savant statements', () => {
	it('waits until every seat has a character', () => {
		const { game: g, seats } = castGame(['savant', 'chef', 'empath', 'butler']);
		expect(savantStatements(g, seats[0], characters)).toEqual([]);
	});

	it('works out which characters are in play', () => {
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		expect(byKey(all, 'in-play:chef')?.truth).toBe('true');
		expect(byKey(all, 'not-in-play:chef')?.truth).toBe('false');
		expect(byKey(all, 'in-play:washerwoman')?.truth).toBe('false');
		// Never "the Imp is in play": the Demon has its own lines.
		expect(byKey(all, 'in-play:imp')).toBeUndefined();
	});

	it('counts like the Empath from the Savant’s living neighbours', () => {
		// Seat 0's neighbours are the Monk (seat 6) and the Chef (seat 1): none evil.
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		expect(byKey(all, 'evil-neighbours:0')?.truth).toBe('true');
		expect(byKey(all, 'evil-neighbours:1')?.truth).toBe('false');
	});

	it('counts adjacent evil pairs like the Chef', () => {
		// The Poisoner (4) sits beside the Imp (5): one pair.
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		expect(byKey(all, 'evil-pairs:1')?.truth).toBe('true');
		expect(byKey(all, 'evil-pairs:0')?.truth).toBe('false');
		expect(byKey(all, 'demon-beside:minion|yes')?.truth).toBe('true');
		expect(byKey(all, 'demon-minion-distance:1')?.truth).toBe('true');
	});

	it('never makes the Savant’s own seat a blank', () => {
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		expect(all.some((s) => s.parts.some((p) => 'seat' in p && p.seat === seats[0]))).toBe(false);
	});

	it('leaves out what everyone knows: one Demon on the script names no Demon', () => {
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		// The test script has the Imp, Zombuul and Legion, so the Demon line is offered.
		expect(byKey(all, 'demon-is:imp')?.truth).toBe('true');
		expect(byKey(all, 'demon-is:zombuul')?.truth).toBe('false');
	});

	it('says why each line holds or not (L49)', () => {
		const { game: g, seats } = castGame(cast);
		const all = savantStatements(g, seats[0], characters);
		// A wrong count names the true one.
		expect(byKey(all, 'evil-pairs:0')?.why).toEqual([byKey(all, 'evil-pairs:1')?.parts]);
		// A character named: where it is, or that it is not in play.
		expect(byKey(all, 'in-play:chef')?.why).toEqual([
			[{ character: 'chef' }, { text: ': ' }, { seat: seats[1] }]
		]);
		expect(byKey(all, 'in-play:washerwoman')?.why).toEqual([
			[{ character: 'washerwoman' }, { text: ': not in play' }]
		]);
		// A player named: their character.
		const seat = byKey(all, `alignment:${seats[4]}|good`);
		expect(seat?.truth).toBe('false');
		expect(seat?.why).toContainEqual([
			{ seat: seats[4] },
			{ text: ' (' },
			{ character: 'poisoner' },
			{ text: ')' }
		]);
		// A character type spoken of: who holds it.
		expect(byKey(all, 'demon-beside:outsider|no')?.why).toContainEqual([
			{ type: 'outsider' },
			{ text: ': ' },
			{ seat: seats[3] },
			{ text: ' (' },
			{ character: 'butler' },
			{ text: ')' }
		]);
	});

	it('marks a line that depends on how the Recluse registers', () => {
		const { game: g, seats } = castGame(['savant', 'recluse', 'empath', 'chef', 'poisoner', 'imp']);
		const all = savantStatements(g, seats[0], characters);
		const line = byKey(all, `alignment:${seats[1]}|evil`);
		expect(line?.truth).toBe('either');
		expect(line?.byDefault).toBe(false);
		expect(line?.dependsOn).toEqual([seats[1]]);
	});
});

describe('Savant situation', () => {
	it('is one true and one false for a sober Savant', () => {
		const { game: g, seats } = castGame(cast);
		expect(savantSituation(g, seats[0], characters)).toEqual({ mode: 'one-each' });
	});

	it('allows any mix while the Savant is poisoned', () => {
		const { game: g, seats } = castGame(cast, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		expect(savantSituation(g, seats[0], characters).impaired).toBe('poisoned');
	});

	it('is both false with a working Vortox', () => {
		const { game: g, seats } = castGame([
			'savant',
			'chef',
			'empath',
			'butler',
			'poisoner',
			'vortox'
		]);
		expect(savantSituation(g, seats[0], characters)).toMatchObject({
			vortox: seats[5],
			mode: 'both-false'
		});
	});
});

describe('Savant pairs', () => {
	const { game: g, seats } = castGame(cast);
	const pool = savantStatements(g, seats[0], characters);

	it('gives one true and one false from different groups', () => {
		for (let seed = 1; seed < 30; seed++) {
			const pair = savantPair(pool, 'one-each', seeded(seed));
			expect(pair.map((s) => s.truth).sort()).toEqual(['false', 'true']);
			expect(pair[0].group).not.toBe(pair[1].group);
		}
	});

	it('gives two of a kind when asked', () => {
		expect(savantPair(pool, 'both-false', seeded()).map((s) => s.truth)).toEqual([
			'false',
			'false'
		]);
		expect(savantPair(pool, 'both-true', seeded()).map((s) => s.truth)).toEqual(['true', 'true']);
	});

	it('cycles the free line to the opposite of the locked one', () => {
		const [kept] = savantPair(pool, 'one-each', seeded(3));
		const want = partnerTruth(kept, 'one-each');
		const next = pickStatement(pool, want, [kept], seeded(4));
		expect(next?.truth).toBe(kept.truth === 'true' ? 'false' : 'true');
		expect(next?.key).not.toBe(kept.key);
	});
});

// Whether the Demon could pass to another player, from the rules data of the Demon and the
// living players: https://wiki.bloodontheclocktower.com/Imp (to a Minion),
// /Fang_Gu (to an Outsider), /Scarlet_Woman (with 5 or more alive), /Pit-Hag (makes a Demon).
describe('The Demon cannot pass to another player', () => {
	const truth = (castIds: string[], ...steps: ((seats: string[]) => Command)[]) => {
		const { session, ctx, seats } = newGame(names.slice(0, castIds.length));
		const s = run(
			session,
			ctx,
			...castIds.map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			...steps.map((f) => f(seats))
		);
		return byKey(savantStatements(s.game, seats[0], characters), 'demon-cannot-pass:')?.truth;
	};
	const dead =
		(i: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });

	it('is false while the Imp has a living Minion', () => {
		expect(truth(['savant', 'chef', 'empath', 'poisoner', 'imp'])).toBe('false');
	});
	it('is true once the Imp has none', () => {
		expect(truth(['savant', 'chef', 'empath', 'poisoner', 'imp'], dead(3))).toBe('true');
	});
	it('is false while the Fang Gu has a living Outsider', () => {
		expect(truth(['savant', 'chef', 'empath', 'butler', 'fanggu'])).toBe('false');
	});
	it('is false while a Scarlet Woman lives with 4 others besides the Demon', () => {
		expect(truth(['savant', 'chef', 'empath', 'scarletwoman', 'vigormortis'])).toBe('false');
		expect(truth(['savant', 'chef', 'empath', 'scarletwoman', 'vigormortis'], dead(1))).toBe(
			'true'
		);
	});
	it('is false while a Pit-Hag lives', () => {
		expect(truth(['savant', 'chef', 'empath', 'pithag', 'vigormortis'])).toBe('false');
	});
});

describe('Savant statements from the game so far', () => {
	/** Seats, then nights: each night's commands run, then New day. */
	function played(castIds: string[], nights: ((seats: string[]) => Command)[][]) {
		const { session, ctx, seats } = newGame(names.slice(0, castIds.length));
		let s = run(
			session,
			ctx,
			...castIds.map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			}))
		);
		for (const night of nights) {
			s = run(s, ctx, ...night.map((f) => f(seats)), { type: 'NewDay' });
		}
		return { game: s.game, seats, dawns: dawnGames(s.log) };
	}

	const poisonOn =
		(i: number) =>
		(s: string[]): Command => ({
			type: 'AddReminder',
			seatId: s[i],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});

	it('knows the Poisoner chose the same player every night (https://wiki.bloodontheclocktower.com/Poisoner)', () => {
		const same = played(cast, [[poisonOn(1)], []]);
		const all = savantStatements(same.game, same.seats[0], characters, same.dawns);
		expect(byKey(all, 'minion-same-player:poisoner')?.truth).toBe('true');
		expect(byKey(all, 'minion-chose:poisoner|chef')?.truth).toBe('true');
	});

	it('sees a character change overnight (https://wiki.bloodontheclocktower.com/Imp)', () => {
		const g = played(cast, [
			[],
			[(s) => ({ type: 'AssignCharacter', seatId: s[4], characterId: 'imp' })]
		]);
		const all = savantStatements(g.game, g.seats[0], characters, g.dawns);
		expect(byKey(all, 'changed-since:character')?.truth).toBe('true');
		expect(byKey(all, 'changed-since:new')?.truth).toBe('true');
	});

	it('says a Minion missed the Demon in a game under 7 players (https://wiki.bloodontheclocktower.com/Glossary, Minion Info)', () => {
		const g = played(['savant', 'chef', 'empath', 'butler', 'poisoner', 'imp'], [[]]);
		const all = savantStatements(g.game, g.seats[0], characters, g.dawns);
		expect(byKey(all, 'minion-unaware:')?.truth).toBe('true');
	});

	it('leaves only the Snake Charmer and declined lines for the Storyteller to check', () => {
		const g = played(cast, [[]]);
		const checks = savantStatements(g.game, g.seats[0], characters, g.dawns).filter(
			(s) => s.truth === 'check'
		);
		expect(checks.map((s) => s.template)).toEqual(['declined']);
	});
});
