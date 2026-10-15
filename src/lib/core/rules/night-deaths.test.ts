/**
 * Night deaths from a character's own ability. Each scenario paraphrases a wiki page:
 * - https://wiki.bloodontheclocktower.com/Gambler
 * - https://wiki.bloodontheclocktower.com/Acrobat
 * - https://wiki.bloodontheclocktower.com/Lycanthrope
 * - https://wiki.bloodontheclocktower.com/Grandmother
 * - https://wiki.bloodontheclocktower.com/Glossary (drunk or poisoned: no ability)
 * - https://wiki.bloodontheclocktower.com/Recluse, /Spy (registration is the Storyteller's call)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { deathCheck, deathVerdict } from './night-deaths.ts';
import { withNightInfo } from './night-info.ts';
import { nightOrder } from './night-order.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

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

const add =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});
const dead =
	(i: number, cause?: string) =>
	(s: string[]): Command => ({
		type: 'SetDead',
		seatId: s[i],
		dead: true,
		...(cause ? { cause } : {})
	});

describe('Gambler', () => {
	const cast = ['gambler', 'chef', 'imp', 'poisoner', 'recluse'];

	it('a right guess kills nobody; a wrong guess kills the Gambler', () => {
		const { game: g, seats } = game(cast);
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[2], characterId: 'imp' }, characters)
		).toMatchObject({ kind: 'no-death' });
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[2], characterId: 'pukka' }, characters)
		).toEqual({ kind: 'dies', seatIds: [seats[0]], because: 'wrong-guess' });
	});

	it('guessing the Townsfolk a Drunk thinks they are is wrong', () => {
		const { game: g, seats } = game(cast, add(1, 'drunk', 'Is The Drunk'));
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[1], characterId: 'chef' }, characters)
		).toMatchObject({ kind: 'dies' });
	});

	it('a poisoned Gambler does not die, and that counts as abnormal', () => {
		const { game: g, seats } = game(cast, add(0, 'poisoner', 'Poisoned'));
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[2], characterId: 'pukka' }, characters)
		).toMatchObject({
			kind: 'no-death',
			abnormal: [{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[3] }]
		});
	});

	it('asks when the target might register as the guessed character’s type', () => {
		const { game: g, seats } = game(cast);
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[4], characterId: 'imp' }, characters)
		).toMatchObject({ kind: 'ask', ifYes: [seats[0]] });
		// The Recluse cannot register as a Townsfolk.
		expect(
			deathVerdict(g, seats[0], 'gambler', { seatId: seats[4], characterId: 'chef' }, characters)
		).toMatchObject({ kind: 'dies' });
	});

	it('needs a player and a character', () => {
		const { game: g, seats } = game(cast);
		expect(deathVerdict(g, seats[0], 'gambler', { seatId: seats[1] }, characters)).toMatchObject({
			kind: 'choose'
		});
	});
});

describe('Acrobat', () => {
	const cast = ['acrobat', 'chef', 'imp', 'poisoner', 'sailor'];

	it('dies when the chosen player is drunk or poisoned', () => {
		const { game: g, seats } = game(cast, add(1, 'poisoner', 'Poisoned'));
		expect(deathVerdict(g, seats[0], 'acrobat', { seatId: seats[1] }, characters)).toMatchObject({
			kind: 'dies',
			seatIds: [seats[0]]
		});
	});

	it('choosing the Drunk kills the Acrobat', () => {
		const { game: g, seats } = game(cast, add(1, 'drunk', 'Is The Drunk'));
		expect(deathVerdict(g, seats[0], 'acrobat', { seatId: seats[1] }, characters)).toMatchObject({
			kind: 'dies'
		});
	});

	it('a sober, healthy choice kills nobody now (it may still become drunk tonight)', () => {
		const { game: g, seats } = game(cast);
		const verdict = deathVerdict(g, seats[0], 'acrobat', { seatId: seats[1] }, characters);
		expect(verdict).toMatchObject({ kind: 'no-death', because: 'chosen-healthy' });
	});

	it('a drunk Acrobat does not die', () => {
		const { game: g, seats } = game(
			cast,
			add(0, 'sailor', 'Drunk'),
			add(1, 'poisoner', 'Poisoned')
		);
		expect(deathVerdict(g, seats[0], 'acrobat', { seatId: seats[1] }, characters)).toMatchObject({
			kind: 'no-death',
			abnormal: [{ reason: 'drunk', characterId: 'sailor' }]
		});
	});
});

describe('Lycanthrope', () => {
	const cast = ['lycanthrope', 'chef', 'imp', 'poisoner', 'recluse', 'monk'];

	it('a good player dies and the Demon does not kill tonight', () => {
		const { game: g, seats } = game(cast);
		expect(
			deathVerdict(g, seats[0], 'lycanthrope', { seatId: seats[1] }, characters)
		).toMatchObject({ kind: 'dies', seatIds: [seats[1]], demonKills: false });
	});

	it('an evil player, or the Faux Paw player, is not killed', () => {
		const { game: g, seats } = game(cast, add(5, 'lycanthrope', 'Faux Paw'));
		expect(
			deathVerdict(g, seats[0], 'lycanthrope', { seatId: seats[3] }, characters)
		).toMatchObject({ kind: 'no-death' });
		expect(
			deathVerdict(g, seats[0], 'lycanthrope', { seatId: seats[5] }, characters)
		).toMatchObject({ kind: 'no-death' });
	});

	it('asks for a Recluse, who might register as evil', () => {
		const { game: g, seats } = game(cast);
		expect(
			deathVerdict(g, seats[0], 'lycanthrope', { seatId: seats[4] }, characters)
		).toMatchObject({ kind: 'ask', ifYes: [seats[4]], demonKills: false });
	});

	it('must choose an alive player', () => {
		const { game: g, seats } = game(cast, dead(1));
		expect(
			deathVerdict(g, seats[0], 'lycanthrope', { seatId: seats[1] }, characters)
		).toMatchObject({ kind: 'choose' });
	});
});

describe('Grandmother', () => {
	const cast = ['grandmother', 'chef', 'imp', 'poisoner'];

	it('dies when the Demon killed the grandchild', () => {
		const { game: g, seats } = game(cast, add(1, 'grandmother', 'Grandchild'), dead(1, 'imp'));
		expect(deathCheck(g, seats[0], 'grandmother', characters)).toMatchObject({
			needs: 'none',
			verdict: { kind: 'dies', seatIds: [seats[0]] }
		});
	});

	it('lives when the grandchild was executed, and asks when the cause is unknown', () => {
		const executed = game(cast, add(1, 'grandmother', 'Grandchild'), dead(1, 'execution'));
		expect(
			deathCheck(executed.game, executed.seats[0], 'grandmother', characters)?.verdict
		).toMatchObject({ kind: 'no-death' });
		const unknown = game(cast, add(1, 'grandmother', 'Grandchild'), dead(1));
		expect(
			deathCheck(unknown.game, unknown.seats[0], 'grandmother', characters)?.verdict
		).toMatchObject({ kind: 'ask', ifYes: [unknown.seats[0]] });
	});

	it('a drunk Grandmother lives (the wiki’s Sailor example)', () => {
		const { game: g, seats } = game(
			[...cast, 'sailor'],
			add(1, 'grandmother', 'Grandchild'),
			add(0, 'sailor', 'Drunk'),
			dead(1, 'demon')
		);
		expect(deathCheck(g, seats[0], 'grandmother', characters)?.verdict).toMatchObject({
			kind: 'no-death',
			abnormal: [{ reason: 'drunk' }]
		});
	});
});

describe('night steps', () => {
	it('the Gambler’s step asks for a choice; the Grandmother’s is worked out', () => {
		const data = committedGameData();
		const { game: g, seats } = game(
			['gambler', 'grandmother', 'chef', 'imp', 'poisoner'],
			add(2, 'grandmother', 'Grandchild'),
			dead(2, 'demon')
		);
		const inPlay = g.seating.map((s) => data.byId.get(g.seats[s].characterId!)!);
		const steps = withNightInfo(
			nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 7 }).steps,
			g,
			characters
		);
		expect(steps.find((s) => s.id === 'gambler')!.info).toMatchObject({
			kind: 'death',
			checks: [{ seatId: seats[0], needs: 'player-character' }]
		});
		expect(steps.find((s) => s.id === 'grandmother')!.info).toMatchObject({
			kind: 'death',
			checks: [{ seatId: seats[1], verdict: { kind: 'dies', seatIds: [seats[1]] } }]
		});
	});
});
