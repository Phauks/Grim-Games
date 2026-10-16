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
 * - https://wiki.bloodontheclocktower.com/Exile, /Travellers (Travellers are exiled, not
 *   executed; the Storyteller chooses their alignment, maybe later)
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/types.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/characters.ts';
import { gameData, newGame, run } from '#lib/core/model/fixtures.test-support.ts';
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
	'beggar'
];
const script: Script = { entries: ids.map((id) => ({ kind: 'official', id })) };
const characters = characterLookup(gameData, script);
const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay'];

function game(cast: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(names.slice(0, cast.length), { script });
	const s = run(
		{ ...session },
		{ ...ctx, characters },
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

const causes = (g: ReturnType<typeof game>['game'], seat: string) =>
	validDeathCauses(g, seat, characters).map((c) => c.cause);
const entry = (g: ReturnType<typeof game>['game'], seat: string, cause: string) =>
	validDeathCauses(g, seat, characters).find((c) => c.cause === cause);

describe('validDeathCauses', () => {
	it('always offers executed and the Demon first and something else last', () => {
		const { game: g, seats } = game(['chef', 'imp']);
		expect(causes(g, seats[0])).toEqual(['execution', 'demon', 'other']);
	});

	it('does not offer the Slayer for a good player, but does for the Demon', () => {
		const { game: g, seats } = game(['chef', 'slayer', 'imp']);
		expect(causes(g, seats[0])).not.toContain('slayer');
		expect(entry(g, seats[2], 'slayer')).toEqual({ cause: 'slayer', kind: 'kills', flags: [] });
	});

	it('offers the Slayer for a Recluse, flagged as registering as the Demon', () => {
		const { game: g, seats } = game(['recluse', 'slayer', 'imp']);
		expect(entry(g, seats[0], 'slayer')?.flags).toEqual([
			{
				code: 'registers',
				source: { characterId: 'recluse', seatId: seats[0] },
				wiki: 'https://wiki.bloodontheclocktower.com/Recluse'
			}
		]);
	});

	it('does not offer the Slayer for a poisoned Recluse, who registers truly', () => {
		const { game: g, seats } = game(
			['recluse', 'slayer', 'imp', 'poisoner'],
			add(0, 'poisoner', 'Poisoned')
		);
		expect(causes(g, seats[0])).not.toContain('slayer');
	});

	it('offers the Slayer for the player babysitting Lil’ Monsta', () => {
		const { game: g, seats } = game(
			['chef', 'slayer', 'lilmonsta', 'poisoner'],
			add(3, 'lilmonsta', 'Is The Demon')
		);
		expect(entry(g, seats[3], 'slayer')?.flags).toEqual([]);
		expect(causes(g, seats[0])).not.toContain('slayer');
	});

	it('does not offer a character nobody has', () => {
		const { game: g, seats } = game(['chef', 'imp']);
		expect(causes(g, seats[1])).not.toContain('slayer');
	});

	it('flags the Slayer when every Slayer is poisoned now', () => {
		const { game: g, seats } = game(
			['chef', 'slayer', 'imp', 'poisoner'],
			add(1, 'poisoner', 'Poisoned')
		);
		expect(entry(g, seats[2], 'slayer')?.flags).toEqual([
			{ code: 'impaired', seatIds: [seats[1]] }
		]);
	});

	it('offers the Golem only for a player who is not the Demon', () => {
		const { game: g, seats } = game(['chef', 'golem', 'imp']);
		expect(causes(g, seats[0])).toContain('golem');
		expect(causes(g, seats[2])).not.toContain('golem');
	});

	it('offers the Lycanthrope for good players, not evil or Faux Paw ones', () => {
		const { game: g, seats } = game(
			['chef', 'lycanthrope', 'imp', 'tinker'],
			add(3, 'lycanthrope', 'Faux Paw')
		);
		expect(causes(g, seats[0])).toContain('lycanthrope');
		expect(causes(g, seats[2])).not.toContain('lycanthrope');
		expect(causes(g, seats[3])).not.toContain('lycanthrope');
	});

	it('offers the Lycanthrope for a Spy, flagged as registering as good', () => {
		const { game: g, seats } = game(['spy', 'lycanthrope', 'imp']);
		expect(entry(g, seats[0], 'lycanthrope')?.flags.map((f) => f.code)).toEqual(['registers']);
	});

	it('offers the Virgin only for a Townsfolk nominator', () => {
		const { game: g, seats } = game(['chef', 'virgin', 'imp', 'tinker']);
		expect(causes(g, seats[0])).toContain('virgin');
		expect(causes(g, seats[3])).not.toContain('virgin');
		expect(causes(g, seats[2])).not.toContain('virgin');
	});

	it('offers the Tinker only on the Tinker', () => {
		const { game: g, seats } = game(['chef', 'tinker', 'imp']);
		expect(causes(g, seats[1])).toContain('tinker');
		expect(causes(g, seats[0])).not.toContain('tinker');
	});

	it('offers the Gangster only for its alive neighbours, skipping the dead', () => {
		const { game: g, seats } = game(['chef', 'gangster', 'imp', 'tinker', 'golem'], (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true
		}));
		expect(causes(g, seats[0])).toContain('gangster');
		expect(causes(g, seats[3])).toContain('gangster');
		expect(causes(g, seats[4])).not.toContain('gangster');
	});

	it('offers exiled instead of executed for a Traveller', () => {
		const { game: g, seats } = game(['chef', 'imp', 'beggar'], (s) => ({
			type: 'SetAlignment',
			seatId: s[2],
			alignment: 'good'
		}));
		expect(causes(g, seats[2])).toEqual(['exile', 'demon', 'other']);
		expect(causes(g, seats[0])[0]).toBe('execution');
	});

	it('flags a rule that needs an alignment when a Traveller has none yet', () => {
		const { game: g, seats } = game(['chef', 'lycanthrope', 'imp', 'beggar']);
		expect(g.seats[seats[3]]).not.toHaveProperty('alignment');
		expect(entry(g, seats[3], 'lycanthrope')?.flags).toEqual([{ code: 'unknown' }]);
	});
});
