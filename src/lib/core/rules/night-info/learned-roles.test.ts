/**
 * "Learn a role" rows: two players, one of them a character of a type. Each scenario
 * paraphrases the wiki pages it encodes:
 * - https://wiki.bloodontheclocktower.com/Investigator: two players, one of them a named
 *   Minion;
 * - https://wiki.bloodontheclocktower.com/Washerwoman: the same with a Townsfolk;
 * - https://wiki.bloodontheclocktower.com/Librarian: an Outsider, or that none are in play;
 * - https://wiki.bloodontheclocktower.com/Recluse: may register as evil and as a Minion;
 * - https://wiki.bloodontheclocktower.com/Spy: may register as good and as a Townsfolk;
 * - https://wiki.bloodontheclocktower.com/Drunk: any information may be given.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from './picker.ts';
import { learnedRoles } from './learned-roles.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay'];

function game(cast: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(names.slice(0, cast.length));
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

function rolesOf(cast: string[], character: string, ...extra: ((seats: string[]) => Command)[]) {
	const { game: g, seats } = game(cast, ...extra);
	const picker = infoPicker(g, seats[cast.indexOf(character)], character, characters)!;
	return { roles: learnedRoles(g, picker, characters)!, seats };
}

const remind =
	(at: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[at],
		reminder: { characterId, label }
	});

describe('learnedRoles', () => {
	it('Investigator: one row per Minion, its true character, true', () => {
		const { roles, seats } = rolesOf(
			['investigator', 'baron', 'poisoner', 'imp', 'chef'],
			'investigator'
		);
		expect(roles.rows).toEqual([
			{ target: seats[1], characterIds: ['baron'], reason: 'true' },
			{ target: seats[2], characterIds: ['poisoner'], reason: 'true' }
		]);
		expect(roles.none).toBeUndefined();
		expect(roles.anyOther).toBeUndefined();
	});

	it('Investigator: the Recluse is a row of its own, shown as any Minion on the script', () => {
		const { roles, seats } = rolesOf(
			['investigator', 'recluse', 'poisoner', 'imp', 'chef'],
			'investigator'
		);
		expect(roles.rows[0]).toEqual({
			target: seats[2],
			characterIds: ['poisoner'],
			reason: 'true'
		});
		const recluse = roles.rows[1];
		expect(recluse).toMatchObject({
			target: seats[1],
			reason: 'registers',
			registered: [seats[1]]
		});
		expect(recluse.characterIds).toEqual(expect.arrayContaining(['baron', 'poisoner', 'spy']));
		expect(recluse.characterIds).not.toContain('chef');
	});

	it('Washerwoman: the Spy may be shown as a Townsfolk', () => {
		const { roles, seats } = rolesOf(['washerwoman', 'spy', 'imp', 'chef', 'monk'], 'washerwoman');
		const spy = roles.rows.find((r) => r.target === seats[1]);
		expect(spy).toMatchObject({ reason: 'registers', registered: [seats[1]] });
		expect(spy?.characterIds).toEqual(expect.arrayContaining(['chef', 'monk', 'washerwoman']));
		expect(roles.rows.filter((r) => r.reason === 'true').map((r) => r.characterIds)).toEqual([
			['chef'],
			['monk']
		]);
	});

	it('Librarian: none in play is valid with no Outsiders', () => {
		const { roles } = rolesOf(['librarian', 'washerwoman', 'imp', 'poisoner', 'chef'], 'librarian');
		expect(roles.rows).toEqual([]);
		expect(roles.none).toBe('true');
	});

	it('puts the row the setup reminders mark first, with its Wrong player', () => {
		const { roles, seats } = rolesOf(
			['investigator', 'baron', 'poisoner', 'imp', 'chef'],
			'investigator',
			remind(2, 'investigator', 'Minion'),
			remind(4, 'investigator', 'Wrong')
		);
		expect(roles.rows[0]).toEqual({
			target: seats[2],
			characterIds: ['poisoner'],
			other: seats[4],
			reason: 'true',
			marked: true
		});
		expect(roles.rows).toHaveLength(2);
	});

	it('a drunk Investigator: any marked player is allowed, shown as any Minion', () => {
		const { roles, seats } = rolesOf(
			['investigator', 'baron', 'imp', 'chef', 'monk'],
			'investigator',
			remind(0, 'drunk', 'Is The Drunk'),
			remind(3, 'investigator', 'Minion')
		);
		expect(roles.anyOther).toBe('unreliable');
		expect(roles.rows[0]).toMatchObject({ target: seats[3], reason: 'unreliable', marked: true });
		expect(roles.rows[0].characterIds).toEqual(expect.arrayContaining(['baron', 'poisoner']));
	});

	it('a marked player who is not that type, with a sober Investigator, is not valid', () => {
		const { roles, seats } = rolesOf(
			['investigator', 'baron', 'imp', 'chef', 'monk'],
			'investigator',
			remind(3, 'investigator', 'Minion')
		);
		expect(roles.rows[0]).toMatchObject({ target: seats[3], reason: 'invalid', marked: true });
		expect(roles.rows[1]).toMatchObject({ target: seats[1], characterIds: ['baron'] });
	});
});
