/** Today's nominations, from the day log (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"). */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame } from '#lib/core/model/fixtures.test-support.ts';
import { characterNominationPrompts, seatNominations, todaysNominations } from './nominations.ts';

const nominate =
	(by: number, who: number) =>
	(s: string[]): Command => ({ type: 'Nominate', nominator: s[by], nominee: s[who] });

describe('todaysNominations', () => {
	it('lists who nominated whom today, in order', () => {
		const { session, seats } = castGame(['chef', 'empath', 'imp'], nominate(0, 2), nominate(1, 0));
		expect(todaysNominations(session.game)).toMatchObject([
			{ nominator: seats[0], nominee: seats[2] },
			{ nominator: seats[1], nominee: seats[0] }
		]);
	});

	it('starts afresh each day', () => {
		const { session } = castGame(['chef', 'imp'], nominate(0, 1), { type: 'NewDay' });
		expect(todaysNominations(session.game)).toEqual([]);
	});
});

describe('seatNominations', () => {
	it('gives a seat the nomination it made and the one it received today', () => {
		const { session, seats } = castGame(['chef', 'empath', 'imp'], nominate(0, 2), nominate(2, 1));
		expect(seatNominations(session.game, seats[2])).toMatchObject({
			made: { nominator: seats[2], nominee: seats[1] },
			received: { nominator: seats[0], nominee: seats[2] }
		});
		expect(seatNominations(session.game, seats[1])).toMatchObject({
			received: { nominator: seats[2] }
		});
		expect(seatNominations(session.game, seats[1]).made).toBeUndefined();
	});
});

// https://wiki.bloodontheclocktower.com/Virgin: the first time the Virgin is nominated, a
// Townsfolk nominator is executed straight away (the Virgin's rules file, `onNominated`).
describe('characterNominationPrompts', () => {
	const ask = (cast: string[], by: number, who: number) => {
		const { session, ctx, seats } = castGame(cast);
		return {
			seats,
			prompts: characterNominationPrompts(
				session.game,
				{ nominator: seats[by], nominee: seats[who] },
				ctx.characters
			)
		};
	};

	it('asks to execute a Townsfolk who nominates the Virgin', () => {
		const { prompts, seats } = ask(['virgin', 'chef', 'imp'], 1, 0);
		expect(prompts).toEqual([
			{ kind: 'execute-nominator', characterId: 'virgin', nominator: seats[1], nominee: seats[0] }
		]);
	});

	it('asks nothing when the nominator is not a Townsfolk, or the Virgin is not nominated', () => {
		expect(ask(['virgin', 'butler', 'imp'], 1, 0).prompts).toEqual([]);
		expect(ask(['virgin', 'chef', 'imp'], 1, 2).prompts).toEqual([]);
	});

	it('asks about a Spy, who might register as a Townsfolk', () => {
		expect(ask(['virgin', 'spy', 'imp'], 1, 0).prompts).toHaveLength(1);
	});

	it('asks nothing once the Virgin has used her ability, or while she is poisoned', () => {
		const used = (s: string[]): Command => ({
			type: 'UseAbility',
			seatId: s[0],
			characterId: 'virgin'
		});
		const { session, ctx, seats } = castGame(['virgin', 'chef', 'imp'], used);
		expect(
			characterNominationPrompts(
				session.game,
				{ nominator: seats[1], nominee: seats[0] },
				ctx.characters
			)
		).toEqual([]);
		const poisoned = castGame(['virgin', 'chef', 'poisoner', 'imp'], (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		expect(
			characterNominationPrompts(
				poisoned.session.game,
				{ nominator: poisoned.seats[1], nominee: poisoned.seats[0] },
				poisoned.ctx.characters
			)
		).toEqual([]);
	});
});
