/**
 * "Learn players" rows, marked by the character's reminders first. Each scenario
 * paraphrases the wiki pages it encodes:
 * - https://wiki.bloodontheclocktower.com/Steward: the player learns one good player;
 * - https://wiki.bloodontheclocktower.com/Noble: three players, exactly one of them evil;
 * - https://wiki.bloodontheclocktower.com/Recluse: may register as evil;
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
import { chosenPlayers } from './chosen-players.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay'];

function rowsOf(cast: string[], character: string, ...extra: ((seats: string[]) => Command)[]) {
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
	const picker = infoPicker(s.game, seats[cast.indexOf(character)], character, characters)!;
	return { players: chosenPlayers(s.game, picker)!, seats };
}

const know =
	(at: number, characterId: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[at],
		reminder: { characterId, label: 'Know' }
	});

describe('chosenPlayers', () => {
	it('Steward: one row per good player, true', () => {
		const { players, seats } = rowsOf(['steward', 'imp', 'chef', 'monk'], 'steward');
		expect(players.rows).toEqual([
			{ target: seats[2], seats: [], reason: 'true' },
			{ target: seats[3], seats: [], reason: 'true' }
		]);
		expect(players.anyOther).toBeUndefined();
	});

	it('Steward: the player with Know comes first, marked', () => {
		const { players, seats } = rowsOf(
			['steward', 'imp', 'chef', 'monk'],
			'steward',
			know(3, 'steward')
		);
		expect(players.rows).toEqual([
			{ target: seats[3], seats: [], reason: 'true', marked: true, exact: true },
			{ target: seats[2], seats: [], reason: 'true' }
		]);
	});

	it('Steward: Know on an evil player is not valid, still first', () => {
		const { players, seats } = rowsOf(
			['steward', 'imp', 'chef', 'monk'],
			'steward',
			know(1, 'steward')
		);
		expect(players.rows[0]).toMatchObject({ target: seats[1], reason: 'invalid', marked: true });
		expect(players.rows).toHaveLength(3);
	});

	it('Steward: a Recluse with Know is good, so true', () => {
		const { players, seats } = rowsOf(
			['steward', 'imp', 'recluse', 'monk'],
			'steward',
			know(2, 'steward')
		);
		expect(players.rows[0]).toMatchObject({ target: seats[2], reason: 'true', marked: true });
	});

	it('Noble: rows grouped by the evil player, with who may be shown beside them', () => {
		const { players, seats } = rowsOf(['noble', 'imp', 'chef', 'monk', 'poisoner'], 'noble');
		expect(players.rows).toEqual([
			{ target: seats[1], seats: [seats[2], seats[3]], reason: 'true' },
			{ target: seats[4], seats: [seats[2], seats[3]], reason: 'true' }
		]);
	});

	it('Noble: the three marked players come first, as one exact row', () => {
		const { players, seats } = rowsOf(
			['noble', 'chef', 'monk', 'imp', 'poisoner'],
			'noble',
			know(1, 'noble'),
			know(2, 'noble'),
			know(4, 'noble')
		);
		expect(players.rows[0]).toEqual({
			target: seats[4],
			seats: [seats[1], seats[2]],
			reason: 'true',
			marked: true,
			exact: true
		});
		expect(players.rows).toHaveLength(3);
	});

	it('Noble: three marked players with two evil are not valid', () => {
		const { players } = rowsOf(
			['noble', 'chef', 'monk', 'imp', 'poisoner'],
			'noble',
			know(1, 'noble'),
			know(3, 'noble'),
			know(4, 'noble')
		);
		expect(players.rows[0]).toMatchObject({ reason: 'invalid', marked: true, exact: true });
	});

	it('Noble: with one Know placed so far, rows holding that player come first', () => {
		const { players, seats } = rowsOf(
			['noble', 'chef', 'monk', 'imp', 'poisoner'],
			'noble',
			know(4, 'noble')
		);
		expect(players.rows[0]).toMatchObject({ target: seats[4], marked: true });
		expect(players.rows[0].exact).toBeUndefined();
		expect(players.rows[1].marked).toBeUndefined();
	});

	it('Noble: a Recluse may be the evil one, by registration', () => {
		const { players, seats } = rowsOf(['noble', 'recluse', 'chef', 'monk', 'imp'], 'noble');
		expect(players.rows.find((r) => r.target === seats[1])).toMatchObject({
			reason: 'registers',
			registered: [seats[1]]
		});
	});

	it('a drunk Steward: any player is allowed, the marked one still first', () => {
		const { players, seats } = rowsOf(
			['steward', 'imp', 'chef', 'monk'],
			'steward',
			(s) => ({
				type: 'AddReminder',
				seatId: s[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}),
			know(1, 'steward')
		);
		expect(players.anyOther).toBe('unreliable');
		expect(players.rows[0]).toMatchObject({ target: seats[1], reason: 'unreliable', marked: true });
	});
});
