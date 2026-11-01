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
import { parseCharacter } from '#lib/core/data/parse.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import {
	castGame,
	newGame,
	run,
	testCharacters as characters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import {
	becomesOffer,
	changeableSeats,
	characterChanger,
	minionsLeft,
	neighbourAlignments,
	swappableSeats
} from './becomes.ts';

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
	/** The seat that changes, when not the carrier. */
	changes?: number;
	expected: object;
}

/** For each kind of change, a game where the token has something to change. */
const SCENARIOS: Record<
	'demon' | 'evil' | 'swap' | 'carrier-alignment',
	(id: CharacterId) => Scenario
> = {
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
	swap: (id) => ({ cast: [id, 'chef', 'imp'], carrier: 2, expected: { into: 'swap' } }),
	// The character's good player takes an evil carrier's alignment.
	'carrier-alignment': (id) => ({
		cast: [id, 'chef', 'imp'],
		carrier: 2,
		changes: 0,
		expected: { into: 'alignment', characterId: id, alignment: 'evil' }
	})
};

const BECOMES = [...OFFICIAL_RULES].flatMap(([id, r]) => (r.becomes ? [{ id, ...r.becomes }] : []));

describe('every becomes rule offers its change, at its moment only', () => {
	it('covers the characters the wiki says change a player', () => {
		expect(BECOMES.map((b) => b.id).sort()).toEqual([
			'goon',
			'mezepheles',
			'ogre',
			'scarletwoman',
			'snakecharmer'
		]);
	});

	it.each(BECOMES)('$id: $token', ({ id, token, into, when: removed }) => {
		const when = removed ?? ('placed' as const);
		const { cast, steps = [], carrier, changes = carrier, expected } = SCENARIOS[into](id);
		const { session, seats } = castGame(cast, ...steps);
		const reminder = { characterId: id, label: token };
		const other = when === 'placed' ? ('removed' as const) : ('placed' as const);
		const offer = becomesOffer(session.game, seats[carrier], reminder, characters, when);
		expect(offer).toMatchObject({ ...expected, seatId: seats[changes] });
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

// A character whose night step changes a chosen player's character (`changesCharacter`):
// https://wiki.bloodontheclocktower.com/Summoner (on the 3rd night, a player becomes an evil
// Demon of its choice), https://wiki.bloodontheclocktower.com/Pit-Hag (each night*, a player
// becomes a not-in-play character) and https://wiki.bloodontheclocktower.com/Huntsman (once
// per game, the Damsel, if chosen, becomes a not-in-play Townsfolk).
describe('a character that changes a chosen player (changesCharacter)', () => {
	const remind =
		(i: number, characterId: string, label: string) =>
		(s: string[]): Command => ({
			type: 'AddReminder',
			seatId: s[i],
			reminder: { characterId, label }
		});

	it('is the Summoner, the Pit-Hag and the Huntsman', () => {
		const changers = [...OFFICIAL_RULES].filter(([, r]) => r.changesCharacter).map(([id]) => id);
		expect(changers.sort()).toEqual([
			'cacklejack',
			'engineer',
			'hatter',
			'huntsman',
			'kazali',
			'pithag',
			'summoner'
		]);
	});

	it('asks on the night its token is on its own living player', () => {
		const { session, seats } = castGame(
			['summoner', 'chef', 'empath'],
			remind(0, 'summoner', 'Night 3')
		);
		expect(characterChanger(session.game, 'summoner', characters)).toBe(seats[0]);
	});

	it('does not ask before its night, or once its player is dead', () => {
		const early = castGame(['summoner', 'chef', 'empath'], remind(0, 'summoner', 'Night 2'));
		expect(characterChanger(early.session.game, 'summoner', characters)).toBeUndefined();
		const gone = castGame(
			['summoner', 'chef', 'empath'],
			remind(0, 'summoner', 'Night 3'),
			dead(0)
		);
		expect(characterChanger(gone.session.game, 'summoner', characters)).toBeUndefined();
	});

	it('the chosen player becomes the Demon, evil', () => {
		const { session, seats, ctx } = castGame(
			['summoner', 'chef', 'empath'],
			remind(0, 'summoner', 'Night 3')
		);
		const { game } = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[1],
			characterId: 'nodashii',
			alignment: 'evil'
		});
		expect(game.seats[seats[1]]).toMatchObject({ characterId: 'nodashii', alignment: 'evil' });
	});

	it('asks each night for a living Pit-Hag, who may change anyone', () => {
		const { session, seats } = castGame(['pithag', 'chef', 'empath', 'imp']);
		expect(characterChanger(session.game, 'pithag', characters)).toBe(seats[0]);
		expect(changeableSeats(session.game, 'pithag', characters)).toEqual(seats);
		expect(OFFICIAL_RULES.get('pithag')?.changesCharacter).toMatchObject({ notInPlay: true });
	});

	// https://wiki.bloodontheclocktower.com/Pit-Hag (Tips): changing a Traveller is an optional
	// rule the Storyteller may allow, so the Pit-Hag skips Travellers unless the game turns it on.
	it('skips Travellers, unless the game plays the Pit-Hag optional rule', () => {
		const cast: CharacterId[] = ['pithag', 'chef', 'empath', 'imp', 'gunslinger'];
		const off = castGame(cast);
		expect(changeableSeats(off.session.game, 'pithag', characters)).toEqual(off.seats.slice(0, 4));
		const on = castGame(cast, () => ({
			type: 'SetOptionalRule',
			characterId: 'pithag',
			on: true
		}));
		expect(changeableSeats(on.session.game, 'pithag', characters)).toEqual(on.seats);
	});

	it('asks the Huntsman only while a Damsel is in play and before its No Ability', () => {
		const none = castGame(['huntsman', 'chef', 'empath']);
		expect(characterChanger(none.session.game, 'huntsman', characters)).toBeUndefined();
		const { session, seats } = castGame(['huntsman', 'damsel', 'empath']);
		expect(characterChanger(session.game, 'huntsman', characters)).toBe(seats[0]);
		expect(changeableSeats(session.game, 'huntsman', characters)).toEqual([seats[1]]);
		const used = castGame(['huntsman', 'damsel', 'empath'], remind(0, 'huntsman', 'No Ability'));
		expect(characterChanger(used.session.game, 'huntsman', characters)).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Hatter: if it died today or tonight, each Minion and
	// Demon player may become another character of their own type.
	it('asks for the dead Hatter, and changes only the Minions and Demon', () => {
		const { session, seats } = castGame(['hatter', 'chef', 'poisoner', 'imp'], dead(0));
		expect(characterChanger(session.game, 'hatter', characters)).toBe(seats[0]);
		expect(changeableSeats(session.game, 'hatter', characters)).toEqual(seats.slice(2));
		const none = castGame(['hatter', 'chef', 'empath'], dead(0));
		expect(characterChanger(none.session.game, 'hatter', characters)).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Engineer: once per game it chooses which Minions or
	// which Demon are in play; the evil players keep their type, and No Ability marks it used.
	it('asks the living Engineer to change the Minions or Demon, until No Ability', () => {
		const { session, seats } = castGame(['engineer', 'chef', 'poisoner', 'imp']);
		expect(characterChanger(session.game, 'engineer', characters)).toBe(seats[0]);
		expect(changeableSeats(session.game, 'engineer', characters)).toEqual(seats.slice(2));
		const used = castGame(
			['engineer', 'chef', 'poisoner', 'imp'],
			remind(0, 'engineer', 'No Ability')
		);
		expect(characterChanger(used.session.game, 'engineer', characters)).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Kazali: no Minions are dealt; on the first night the
	// Kazali makes players into evil Minions, one at a time, up to the usual number.
	it('asks the Kazali on the first night only, until the usual Minions are in play', () => {
		// 7 players usually have one Minion.
		const cast = ['kazali', 'chef', 'empath', 'monk', 'butler', 'saint', 'mayor'];
		const { session, seats } = castGame(cast);
		expect(minionsLeft(session.game, characters)).toBe(1);
		expect(characterChanger(session.game, 'kazali', characters)).toBe(seats[0]);
		expect(changeableSeats(session.game, 'kazali', characters)).toEqual(seats.slice(1));
		const later = { ...session.game, pastDays: [session.game.today] };
		expect(characterChanger(later, 'kazali', characters)).toBeUndefined();
		const full = castGame(['kazali', 'poisoner', 'empath', 'monk', 'butler', 'saint', 'mayor']);
		expect(minionsLeft(full.session.game, characters)).toBe(0);
		expect(characterChanger(full.session.game, 'kazali', characters)).toBeUndefined();
	});

	// A homebrew Minion that turns a chosen player into an Outsider each night: its rules block
	// alone gives it the step; without it, there is none.
	it('works for a custom character through its rules block', () => {
		const tailor = {
			id: 'tailor',
			name: 'Tailor',
			team: 'minion',
			ability: 'Each night*, choose a player: they become a not-in-play Outsider.',
			rules: { changesCharacter: { types: ['outsider'], notInPlay: true } }
		};
		const issues = new Issues();
		const character = parseCharacter(tailor, '[0]', issues, {
			strict: false,
			scriptFields: true
		});
		expect(issues.list).toEqual([]);
		const all = new Map([...characters, [character!.id, character!]]);
		const created = newGame(3, { ctx: testContext({ characters: all }) });
		const session = run(
			created.session,
			created.ctx,
			...['tailor', 'chef', 'empath'].map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: created.seats[i],
				characterId
			}))
		);
		expect(characterChanger(session.game, 'tailor', all)).toBe(created.seats[0]);
		const plain = new Map([...characters, [character!.id, { ...character!, rules: undefined }]]);
		expect(characterChanger(session.game, 'tailor', plain)).toBeUndefined();
	});
});

// https://wiki.bloodontheclocktower.com/Barber: if the Barber died today or tonight, the Demon
// may choose 2 players (not another Demon) to swap characters; alignments stay.
describe('a character whose step swaps two players (swapsCharacters)', () => {
	it('is the Barber', () => {
		const swappers = [...OFFICIAL_RULES].filter(([, r]) => r.swapsCharacters).map(([id]) => id);
		expect(swappers).toEqual(['barber']);
	});

	it('offers every player, a Demon only to swap itself, not another Demon', () => {
		const { session, seats } = castGame(['barber', 'chef', 'empath', 'imp', 'pukka']);
		expect(swappableSeats(session.game, 'barber', characters)).toEqual(seats);
		expect(swappableSeats(session.game, 'barber', characters, seats[3])).toEqual(
			seats.slice(0, 3)
		);
		expect(swappableSeats(session.game, 'barber', characters, seats[1])).toEqual([
			seats[0],
			seats[2],
			seats[3],
			seats[4]
		]);
		expect(swappableSeats(session.game, 'chef', characters)).toEqual([]);
	});

	it('swaps characters and keeps alignments', () => {
		const { session, seats, ctx } = castGame(['barber', 'chef', 'poisoner']);
		const { game } = run(session, ctx, {
			type: 'SwapCharacters',
			seatId: seats[1],
			withSeatId: seats[2],
			keepAlignments: true
		});
		expect(game.seats[seats[1]]).toMatchObject({ characterId: 'poisoner', alignment: 'good' });
		expect(game.seats[seats[2]]).toMatchObject({ characterId: 'chef', alignment: 'evil' });
	});
});

// https://wiki.bloodontheclocktower.com/Goon and https://wiki.bloodontheclocktower.com/Ogre: the
// Goon becomes the alignment of the first player to choose it; the Ogre, of the friend it chose.
describe("becomesOffer: the Goon and the Ogre take the carrier's alignment", () => {
	it('offers nothing when the alignments already match', () => {
		const { session, seats } = castGame(['goon', 'chef', 'imp']);
		const drunk = { characterId: 'goon', label: 'Drunk' };
		expect(becomesOffer(session.game, seats[1], drunk, characters)).toBeUndefined();
	});

	it('turns an evil Ogre good when its friend is good', () => {
		const { session, seats, ctx } = castGame(['ogre', 'chef', 'imp']);
		const evil = run(session, ctx, { type: 'SetAlignment', seatId: seats[0], alignment: 'evil' });
		const friend = { characterId: 'ogre', label: 'Friend' };
		expect(becomesOffer(evil.game, seats[1], friend, characters)).toMatchObject({
			into: 'alignment',
			seatId: seats[0],
			alignment: 'good'
		});
	});

	it('offers nothing while the Goon is drunk, but the Ogre changes even if drunk', () => {
		const goon = castGame(['goon', 'chef', 'imp', 'poisoner']);
		const poisoned = run(goon.session, goon.ctx, {
			type: 'AddReminder',
			seatId: goon.seats[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});
		const drunk = { characterId: 'goon', label: 'Drunk' };
		expect(becomesOffer(poisoned.game, goon.seats[2], drunk, characters)).toBeUndefined();

		const ogre = castGame(['ogre', 'chef', 'imp', 'poisoner']);
		const poisonedOgre = run(ogre.session, ogre.ctx, {
			type: 'AddReminder',
			seatId: ogre.seats[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});
		const friend = { characterId: 'ogre', label: 'Friend' };
		expect(becomesOffer(poisonedOgre.game, ogre.seats[2], friend, characters)).toMatchObject({
			into: 'alignment',
			seatId: ogre.seats[0],
			alignment: 'evil'
		});
	});
});

// https://wiki.bloodontheclocktower.com/Cult_Leader: each night it becomes the alignment of an
// alive neighbour; when they differ, either.
describe("the Cult Leader takes a living neighbour's alignment (takesNeighbourAlignment)", () => {
	it('is the Cult Leader', () => {
		const takers = [...OFFICIAL_RULES].filter(([, r]) => r.takesNeighbourAlignment);
		expect(takers.map(([id]) => id)).toEqual(['cultleader']);
	});

	it('offers both when the neighbours differ, one when they agree, skipping the dead', () => {
		const mixed = castGame(['imp', 'cultleader', 'chef', 'empath']);
		expect(neighbourAlignments(mixed.session.game, 'cultleader', characters)).toEqual({
			seatId: mixed.seats[1],
			alignments: ['evil', 'good']
		});
		const good = castGame(['imp', 'cultleader', 'chef', 'empath'], dead(0));
		expect(neighbourAlignments(good.session.game, 'cultleader', characters)?.alignments).toEqual([
			'good'
		]);
		const gone = castGame(['imp', 'cultleader', 'chef'], dead(1));
		expect(neighbourAlignments(gone.session.game, 'cultleader', characters)).toBeUndefined();
	});
});
