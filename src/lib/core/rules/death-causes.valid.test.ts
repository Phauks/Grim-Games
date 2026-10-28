/**
 * Which causes of death are valid for one player, given the grimoire. Each scenario
 * paraphrases the wiki page it encodes:
 * - https://wiki.bloodontheclocktower.com/Slayer (only the Demon dies; a Recluse may register as it)
 * - https://wiki.bloodontheclocktower.com/Recluse, /Spy (false registration)
 * - https://wiki.bloodontheclocktower.com/Golem (a nominee who is not the Demon dies)
 * - https://wiki.bloodontheclocktower.com/Lycanthrope (only good players die; Faux Paw registers evil)
 * - https://wiki.bloodontheclocktower.com/Virgin (a Townsfolk nominator is executed)
 * - https://wiki.bloodontheclocktower.com/Gangster (kills an alive neighbour)
 * - https://wiki.bloodontheclocktower.com/Tinker (only its own death)
 * - https://wiki.bloodontheclocktower.com/Lil%27_Monsta (the babysitter is the Demon)
 * - https://wiki.bloodontheclocktower.com/Poisoner (a poisoned player's ability does nothing)
 * - https://wiki.bloodontheclocktower.com/Cannibal, /Pixie, /Philosopher (a gained ability
 *   kills only as the character it came from)
 * - https://wiki.bloodontheclocktower.com/Exile, /Travellers (Travellers are exiled, not
 *   executed; the Storyteller chooses their alignment, maybe later)
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/types.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/characters.ts';
import { castWith, gameData, type CastGame } from '#lib/core/model/fixtures.test-support.ts';
import { validDeathCauses } from './death-causes.ts';

const ids: CharacterId[] = [
	'chef',
	'slayer',
	'virgin',
	'lycanthrope',
	'tinker',
	'recluse',
	'spy',
	'poisoner',
	'golem',
	'imp',
	'lilmonsta',
	'gangster',
	'beggar',
	'cannibal',
	'pixie',
	'philosopher'
];
const script: Script = { entries: ids.map((id) => ({ kind: 'official', id })) };
const characters = characterLookup(gameData, script);
const scriptGame = castWith({ script, characters });

const add =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});

const causes = (g: CastGame['game'], seat: string) =>
	validDeathCauses(g, seat, characters).map((c) => c.cause);
const entry = (g: CastGame['game'], seat: string, cause: string) =>
	validDeathCauses(g, seat, characters).find((c) => c.cause === cause);

describe('validDeathCauses', () => {
	it('offers executed and the Demon first, and never something else', () => {
		const { game: g, seats } = scriptGame(['chef', 'imp']);
		expect(causes(g, seats[0])).toEqual(['execution', 'demon']);
	});

	it('does not offer the Slayer for a good player, but does for the Demon', () => {
		const { game: g, seats } = scriptGame(['chef', 'slayer', 'imp']);
		expect(causes(g, seats[0])).not.toContain('slayer');
		expect(entry(g, seats[2], 'slayer')).toEqual({ cause: 'slayer', kind: 'kills', flags: [] });
	});

	it('offers the Slayer for a Recluse, flagged as registering as the Demon', () => {
		const { game: g, seats } = scriptGame(['recluse', 'slayer', 'imp']);
		expect(entry(g, seats[0], 'slayer')?.flags).toEqual([
			{
				code: 'registers',
				source: { characterId: 'recluse', seatId: seats[0] },
				wiki: 'https://wiki.bloodontheclocktower.com/Recluse'
			}
		]);
	});

	it('does not offer the Slayer for a poisoned Recluse, who registers truly', () => {
		const { game: g, seats } = scriptGame(
			['recluse', 'slayer', 'imp', 'poisoner'],
			add(0, 'poisoner', 'Poisoned')
		);
		expect(causes(g, seats[0])).not.toContain('slayer');
	});

	it('offers the Slayer for the player babysitting Lil’ Monsta', () => {
		const { game: g, seats } = scriptGame(
			['chef', 'slayer', 'lilmonsta', 'poisoner'],
			add(3, 'lilmonsta', 'Is The Demon')
		);
		expect(entry(g, seats[3], 'slayer')?.flags).toEqual([]);
		expect(causes(g, seats[0])).not.toContain('slayer');
	});

	it('does not offer a character nobody has', () => {
		const { game: g, seats } = scriptGame(['chef', 'imp']);
		expect(causes(g, seats[1])).not.toContain('slayer');
	});

	it('flags the Slayer when every Slayer is poisoned now', () => {
		const { game: g, seats } = scriptGame(
			['chef', 'slayer', 'imp', 'poisoner'],
			add(1, 'poisoner', 'Poisoned')
		);
		expect(entry(g, seats[2], 'slayer')?.flags).toEqual([
			{ code: 'impaired', seatIds: [seats[1]] }
		]);
	});

	it('offers the Golem only for a player who is not the Demon', () => {
		const { game: g, seats } = scriptGame(['chef', 'golem', 'imp']);
		expect(causes(g, seats[0])).toContain('golem');
		expect(causes(g, seats[2])).not.toContain('golem');
	});

	it('offers the Lycanthrope for good players, not evil or Faux Paw ones', () => {
		const { game: g, seats } = scriptGame(
			['chef', 'lycanthrope', 'imp', 'tinker'],
			add(3, 'lycanthrope', 'Faux Paw')
		);
		expect(causes(g, seats[0])).toContain('lycanthrope');
		expect(causes(g, seats[2])).not.toContain('lycanthrope');
		expect(causes(g, seats[3])).not.toContain('lycanthrope');
	});

	it('offers the Lycanthrope for a Spy, flagged as registering as good', () => {
		const { game: g, seats } = scriptGame(['spy', 'lycanthrope', 'imp']);
		expect(entry(g, seats[0], 'lycanthrope')?.flags.map((f) => f.code)).toEqual(['registers']);
	});

	it('offers the Virgin only for a Townsfolk nominator', () => {
		const { game: g, seats } = scriptGame(['chef', 'virgin', 'imp', 'tinker']);
		expect(causes(g, seats[0])).toContain('virgin');
		expect(causes(g, seats[3])).not.toContain('virgin');
		expect(causes(g, seats[2])).not.toContain('virgin');
	});

	it('offers the Tinker only on the Tinker', () => {
		const { game: g, seats } = scriptGame(['chef', 'tinker', 'imp']);
		expect(causes(g, seats[1])).toContain('tinker');
		expect(causes(g, seats[0])).not.toContain('tinker');
	});

	it('offers the Gangster only for its alive neighbours, skipping the dead', () => {
		const { game: g, seats } = scriptGame(['chef', 'gangster', 'imp', 'tinker', 'golem'], (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true
		}));
		expect(causes(g, seats[0])).toContain('gangster');
		expect(causes(g, seats[3])).toContain('gangster');
		expect(causes(g, seats[4])).not.toContain('gangster');
	});

	it('offers exiled instead of executed for a Traveller', () => {
		const { game: g, seats } = scriptGame(['chef', 'imp', 'beggar'], (s) => ({
			type: 'SetAlignment',
			seatId: s[2],
			alignment: 'good'
		}));
		expect(causes(g, seats[2])).toEqual(['exile', 'demon']);
		expect(causes(g, seats[0])[0]).toBe('execution');
	});

	it('flags a rule that needs an alignment when a Traveller has none yet', () => {
		const { game: g, seats } = scriptGame(['chef', 'lycanthrope', 'imp', 'beggar']);
		expect(g.seats[seats[3]]).not.toHaveProperty('alignment');
		expect(entry(g, seats[3], 'lycanthrope')?.flags).toEqual([{ code: 'unknown' }]);
	});
});

// Trevor, 2026-10-17: the Cannibal can't cause a death unless the ability it gained can.
describe('gained abilities', () => {
	// https://wiki.bloodontheclocktower.com/Cannibal: the ability of the executee marked Lunch.
	it('offers the Cannibal only with a killing ability from its Lunch', () => {
		const none = scriptGame(['cannibal', 'chef', 'imp']);
		expect(causes(none.game, none.seats[2])).not.toContain('cannibal');
		const chef = scriptGame(['cannibal', 'chef', 'imp'], add(1, 'cannibal', 'Lunch'));
		expect(causes(chef.game, chef.seats[2])).not.toContain('cannibal');
		const slayer = scriptGame(['cannibal', 'slayer', 'imp', 'chef'], add(1, 'cannibal', 'Lunch'));
		expect(entry(slayer.game, slayer.seats[2], 'cannibal')).toEqual({
			cause: 'cannibal',
			kind: 'gained-ability',
			gained: 'slayer',
			flags: []
		});
		// With the Slayer's ability only the Demon dies.
		expect(causes(slayer.game, slayer.seats[3])).not.toContain('cannibal');
	});

	// https://wiki.bloodontheclocktower.com/Cannibal: an evil executee poisons the Cannibal.
	it('flags a poisoned Cannibal', () => {
		const { game: g, seats } = scriptGame(
			['cannibal', 'slayer', 'imp'],
			add(1, 'cannibal', 'Lunch'),
			add(0, 'cannibal', 'Poisoned')
		);
		expect(entry(g, seats[2], 'cannibal')?.flags).toEqual([
			{ code: 'impaired', seatIds: [seats[0]] }
		]);
	});

	// https://wiki.bloodontheclocktower.com/Pixie: only once it has the ability.
	it('offers the Pixie once it has a killing Townsfolk’s ability', () => {
		const mad = scriptGame(['pixie', 'slayer', 'imp'], add(1, 'pixie', 'Mad'));
		expect(causes(mad.game, mad.seats[2])).not.toContain('pixie');
		const has = scriptGame(['pixie', 'slayer', 'imp'], add(1, 'pixie', 'Has Ability'));
		expect(entry(has.game, has.seats[2], 'pixie')?.gained).toBe('slayer');
	});

	// https://wiki.bloodontheclocktower.com/Philosopher: the chosen character's ability,
	// marked by its Drunk reminder or by swapping the Philosopher's token.
	it('offers the Philosopher with the ability it chose', () => {
		const idle = scriptGame(['philosopher', 'slayer', 'imp']);
		expect(causes(idle.game, idle.seats[2])).not.toContain('philosopher');
		const drunk = scriptGame(['philosopher', 'slayer', 'imp'], add(1, 'philosopher', 'Drunk'));
		expect(entry(drunk.game, drunk.seats[2], 'philosopher')?.gained).toBe('slayer');
	});
});

// https://wiki.bloodontheclocktower.com/Vizier: they cannot die during the day.
describe('a player who cannot die by day', () => {
	it('has every cause but the execution flagged by day, and none at night', () => {
		const g = scriptGame(['vizier', 'slayer', 'imp']);
		const byDay = validDeathCauses(g.game, g.seats[0], characters, { day: true });
		const flagged = (cause: string) =>
			byDay.find((c) => c.cause === cause)?.flags.map((f) => f.code) ?? [];
		expect(flagged('execution')).toEqual([]);
		expect(flagged('demon')).toEqual(['protected-by-day']);
		expect(byDay.find((c) => c.cause === 'demon')?.flags[0]).toMatchObject({
			source: { characterId: 'vizier', seatId: g.seats[0] }
		});
		const atNight = validDeathCauses(g.game, g.seats[0], characters);
		expect(atNight.every((c) => c.flags.length === 0)).toBe(true);
		// Another player is not covered.
		const other = validDeathCauses(g.game, g.seats[1], characters, { day: true });
		expect(other.every((c) => c.flags.length === 0)).toBe(true);
	});
});
