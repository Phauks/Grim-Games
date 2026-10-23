/**
 * Kills that didn't happen. Each scenario paraphrases the wiki page it cites.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { preventedDeaths, type PreventedDeath } from './prevented-deaths.ts';

function game(cast: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(cast.length);
	const s = run(
		session,
		ctx,
		...cast.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((f) => f(seats))
	);
	return { game: s.game, seats };
}

const add =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});
const dies =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });

/** `killer→seat: reasons`, easy to read in a failure. */
function short(list: PreventedDeath[], seats: string[]): string[] {
	return list.map(
		(p) =>
			`${p.killer}→${seats.indexOf(p.seatId)}: ${p.because
				.map((b) =>
					b.kind === 'protected'
						? `protected by ${b.source === 'override' ? 'override' : b.source.characterId}`
						: b.kind === 'killer-impaired'
							? `${b.impairments[0].reason} by ${b.impairments[0].source.characterId}`
							: b.source.characterId
				)
				.join(', ')}`
	);
}

describe('preventedDeaths', () => {
	// https://wiki.bloodontheclocktower.com/Soldier: safe from the Demon.
	it('the Imp chose the Soldier, who is still alive', () => {
		const { game: g, seats } = game(['imp', 'soldier', 'chef'], add(1, 'imp', 'Dead'));
		expect(short(preventedDeaths(g, characters), seats)).toEqual(['imp→1: protected by soldier']);
	});

	// https://wiki.bloodontheclocktower.com/Monk: the Monk's Safe player survives the Demon.
	it('the Monk protected the chosen player', () => {
		const { game: g, seats } = game(
			['imp', 'monk', 'chef'],
			add(2, 'monk', 'Safe'),
			add(2, 'imp', 'Dead')
		);
		expect(short(preventedDeaths(g, characters), seats)).toEqual(['imp→2: protected by monk']);
	});

	// https://wiki.bloodontheclocktower.com/Poisoner: a poisoned Imp's kill does nothing.
	it('the Imp was poisoned', () => {
		const { game: g, seats } = game(
			['imp', 'poisoner', 'chef'],
			add(0, 'poisoner', 'Poisoned'),
			add(2, 'imp', 'Dead')
		);
		expect(short(preventedDeaths(g, characters), seats)).toEqual(['imp→2: poisoned by poisoner']);
	});

	// https://wiki.bloodontheclocktower.com/Soldier: a poisoned Soldier is not safe, so the
	// board can't explain the survival and leaves it to the Storyteller.
	it('names no reason when the protection did not work', () => {
		const { game: g, seats } = game(
			['imp', 'soldier', 'poisoner'],
			add(1, 'poisoner', 'Poisoned'),
			add(1, 'imp', 'Dead')
		);
		expect(short(preventedDeaths(g, characters), seats)).toEqual(['imp→1: ']);
	});

	// https://wiki.bloodontheclocktower.com/Mayor: the Demon's kill may land elsewhere.
	it('the Imp chose the Mayor', () => {
		const { game: g, seats } = game(['imp', 'mayor', 'chef'], add(1, 'imp', 'Dead'), dies(2));
		expect(short(preventedDeaths(g, characters), seats)).toEqual(['imp→1: mayor']);
	});

	it('lists nobody whose kill landed, and skips other tokens', () => {
		const { game: g } = game(
			['imp', 'chef', 'monk'],
			add(1, 'imp', 'Dead'),
			dies(1),
			add(2, 'monk', 'Safe')
		);
		expect(preventedDeaths(g, characters)).toEqual([]);
	});
});
