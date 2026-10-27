/**
 * Reminders that say a player changed character or alignment (`becomes` in a character's
 * rules): the Scarlet Woman takes over the dead Demon
 * (https://wiki.bloodontheclocktower.com/Scarlet_Woman), the player who said the Mezepheles's
 * word turns evil that night (https://wiki.bloodontheclocktower.com/Mezepheles), and the Snake
 * Charmer swaps characters and alignments with the Demon it chose
 * (https://wiki.bloodontheclocktower.com/Snake_Charmer). The board offers the change; these pin
 * what it offers, and when it offers none.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import {
	castGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { becomesOffer } from './becomes.ts';

const isTheDemon = { characterId: 'scarletwoman', label: 'Is The Demon' };
const turnsEvil = { characterId: 'mezepheles', label: 'Turns Evil' };
const charmed = { characterId: 'snakecharmer', label: 'Poisoned' };
const dead =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });

interface Scenario {
	cast: CharacterId[];
	steps?: ((s: string[]) => Command)[];
	carrier: number;
	expected: object;
}

/** For each kind of change, a game where the token has something to change. */
const SCENARIOS: Record<'demon' | 'evil' | 'swap', (id: CharacterId) => Scenario> = {
	// The Demon dies and the character's player becomes it.
	demon: (id) => ({
		cast: ['chef', 'empath', 'monk', id, 'imp'],
		steps: [dead(4)],
		carrier: 3,
		expected: { into: 'demon', characterId: 'imp' }
	}),
	// A good player turns evil.
	evil: (id) => ({
		cast: ['chef', 'empath', id, 'imp'],
		carrier: 0,
		expected: { into: 'evil', characterId: 'chef' }
	}),
	// The Demon swaps with the character's player.
	swap: (id) => ({ cast: [id, 'chef', 'imp'], carrier: 2, expected: { into: 'swap' } })
};

const BECOMES = [...OFFICIAL_RULES].flatMap(([id, r]) => (r.becomes ? [{ id, ...r.becomes }] : []));

describe('every becomes rule offers its change, at its moment only', () => {
	it('covers the characters the wiki says change a player', () => {
		expect(BECOMES.map((b) => b.id).sort()).toEqual(['mezepheles', 'scarletwoman', 'snakecharmer']);
	});

	it.each(BECOMES)('$id: $token', ({ id, token, into, when: removed }) => {
		const when = removed ?? ('placed' as const);
		const { cast, steps = [], carrier, expected } = SCENARIOS[into](id);
		const { session, seats } = castGame(cast, ...steps);
		const reminder = { characterId: id, label: token };
		const other = when === 'placed' ? ('removed' as const) : ('placed' as const);
		const offer = becomesOffer(session.game, seats[carrier], reminder, characters, when);
		expect(offer).toMatchObject({ ...expected, seatId: seats[carrier] });
		expect(becomesOffer(session.game, seats[carrier], reminder, characters, other)).toBeUndefined();
	});
});

describe('becomesOffer: Scarlet Woman (https://wiki.bloodontheclocktower.com/Scarlet_Woman)', () => {
	const demonOf = (cast: CharacterId[], seat: number, ...deaths: number[]) => {
		const { session, seats } = castGame(cast, ...deaths.map(dead));
		const offer = becomesOffer(session.game, seats[seat], isTheDemon, characters);
		return offer?.into === 'demon' ? offer.characterId : offer;
	};

	it('offers the Scarlet Woman the Demon who just died', () => {
		// Five alive, the Imp executed: she becomes the Imp.
		expect(demonOf(['chef', 'empath', 'monk', 'mayor', 'scarletwoman', 'imp'], 4, 5)).toBe('imp');
	});

	it('prefers a dead Demon to a living one', () => {
		expect(demonOf(['chef', 'empath', 'scarletwoman', 'imp', 'nodashii'], 2, 4)).toBe('nodashii');
	});

	it('offers the Demon in play when none is dead yet', () => {
		expect(demonOf(['chef', 'empath', 'scarletwoman', 'imp'], 2)).toBe('imp');
	});

	it('offers nothing for other reminders, a Demon already, or no Demon on the board', () => {
		const { session, seats } = castGame(['chef', 'empath', 'scarletwoman', 'imp']);
		const game = session.game;
		const poisoned = { characterId: 'poisoner', label: 'Poisoned' };
		expect(becomesOffer(game, seats[2], poisoned, characters)).toBeUndefined();
		expect(becomesOffer(game, seats[3], isTheDemon, characters)).toBeUndefined();
		expect(demonOf(['chef', 'empath', 'scarletwoman'], 2)).toBeUndefined();
	});
});

describe('becomesOffer: Mezepheles (https://wiki.bloodontheclocktower.com/Mezepheles)', () => {
	it('offers to make the player evil when Turns Evil comes off, not when it goes on', () => {
		const { session, seats } = castGame(['chef', 'empath', 'mezepheles', 'imp']);
		const game = session.game;
		expect(becomesOffer(game, seats[1], turnsEvil, characters, 'removed')).toEqual({
			into: 'evil',
			seatId: seats[1],
			characterId: 'empath'
		});
		expect(becomesOffer(game, seats[1], turnsEvil, characters)).toBeUndefined();
	});

	it('offers nothing to a player already evil', () => {
		const { session, seats } = castGame(['chef', 'empath', 'mezepheles', 'imp'], (s) => ({
			type: 'SetAlignment',
			seatId: s[1],
			alignment: 'evil'
		}));
		expect(becomesOffer(session.game, seats[1], turnsEvil, characters, 'removed')).toBeUndefined();
	});
});

describe('becomesOffer: Snake Charmer (https://wiki.bloodontheclocktower.com/Snake_Charmer)', () => {
	it('offers the Demon it chose a swap with the Snake Charmer', () => {
		const { session, seats } = castGame(['snakecharmer', 'chef', 'imp']);
		expect(becomesOffer(session.game, seats[2], charmed, characters)).toEqual({
			into: 'swap',
			seatId: seats[2],
			withSeatId: seats[0]
		});
	});

	it('offers nothing on a player who is not the Demon, so after the swap it just poisons', () => {
		const { session, seats, ctx } = castGame(['snakecharmer', 'chef', 'imp']);
		expect(becomesOffer(session.game, seats[1], charmed, characters)).toBeUndefined();
		const swapped = run(session, ctx, {
			type: 'SwapCharacters',
			seatId: seats[2],
			withSeatId: seats[0]
		});
		expect(becomesOffer(swapped.game, seats[2], charmed, characters)).toBeUndefined();
	});

	it('swaps characters and alignments', () => {
		const { session, seats, ctx } = castGame(['snakecharmer', 'chef', 'imp']);
		const { game } = run(session, ctx, {
			type: 'SwapCharacters',
			seatId: seats[2],
			withSeatId: seats[0]
		});
		expect(game.seats[seats[0]]).toMatchObject({ characterId: 'imp', alignment: 'evil' });
		expect(game.seats[seats[2]]).toMatchObject({ characterId: 'snakecharmer', alignment: 'good' });
	});
});
