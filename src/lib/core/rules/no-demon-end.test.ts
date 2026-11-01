/**
 * The game with no Demon yet (`gameEnd.ends` kind `dead-without-demon`, with `night`), M15j.
 * The Summoner starts a game with no Demon and makes one on its 3rd night
 * (https://wiki.bloodontheclocktower.com/Summoner): until then the game goes on without a
 * Demon; if the Summoner dies first, or that night passes with no Demon made, good wins.
 */
import { describe, expect, it } from 'vitest';
import { Issues } from '#lib/core/data/validate.ts';
import { readGameEnd } from '#lib/core/data/game-end-rules.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { gameEnds } from './game-end.ts';

// Seating: Ana Washerwoman, Ben Chef, Cat Empath, Dan Monk, Eve Summoner.
const start = () => scenario(['washerwoman', 'chef', 'empath', 'monk', 'summoner']);
/** Dawn after `n` nights: day `n` has begun. */
const afterNight = (n: number) => {
	let s = start();
	for (let i = 0; i < n; i++) s = s.newDay();
	return s;
};
const ends = (s: ReturnType<typeof start>) => gameEnds(s.game, s.characters);

describe('dead-without-demon with night', () => {
	it('goes on with no Demon through day 2 and night 3', () => {
		expect(ends(start())).toEqual([]);
		expect(ends(afterNight(1))).toEqual([]);
		expect(ends(afterNight(2))).toEqual([]);
	});

	it('ends for good once night 3 is over and still no Demon was made', () => {
		// The Summoner was drunk on night 3, so nobody became the Demon.
		expect(ends(afterNight(3))).toMatchObject([
			{ rule: 'dead-without-demon', winner: 'good', characterId: 'summoner', day: 3 }
		]);
	});

	it('ends for good when the Summoner dies before night 3', () => {
		expect(ends(afterNight(1).execute('summoner'))).toMatchObject([
			{ rule: 'dead-without-demon', winner: 'good' }
		]);
	});

	it('does not end once the Summoner has made a Demon', () => {
		const s = afterNight(2).becomes('chef', 'imp', 'evil').newDay();
		expect(ends(s)).toEqual([]);
		// That Demon dying ends it as usual.
		expect(ends(s.execute('chef'))).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
	});

	it('reads night as an optional number', () => {
		const issues = new Issues();
		expect(
			readGameEnd(
				{ ends: [{ kind: 'dead-without-demon', winner: 'good', night: 3 }] },
				'gameEnd',
				issues,
				undefined
			)
		).toEqual({ ends: [{ kind: 'dead-without-demon', winner: 'good', night: 3 }] });
		readGameEnd(
			{ ends: [{ kind: 'dead-without-demon', winner: 'good' }] },
			'gameEnd',
			issues,
			undefined
		);
		expect(issues.list).toEqual([]);
	});
});
