/** Today's nominations, from the day log (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"). */
import { describe, expect, it } from 'vitest';
import { dispatch, type Command } from '#lib/core/engine/index.ts';
import { castGame } from '#lib/core/model/fixtures.test-support.ts';
import {
	characterNominationPrompts,
	mayNominate,
	seatNominations,
	todaysNominations
} from './nominations.ts';

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

// https://wiki.bloodontheclocktower.com/Glossary ("Nomination"): dead players may not nominate.
// https://wiki.bloodontheclocktower.com/Banshee: once the Demon has killed them, they may (the
// Banshee's rules file, `nominatesWhenDead`).
describe('mayNominate', () => {
	const die =
		(seat: number, cause?: 'demon' | 'execution' | 'imp') =>
		(s: string[]): Command => ({
			type: 'SetDead',
			seatId: s[seat],
			dead: true,
			...(cause ? { cause } : {})
		});

	it('lets the living nominate and not the dead', () => {
		const { session, ctx, seats } = castGame(['chef', 'empath', 'imp'], die(1, 'demon'));
		expect(mayNominate(session.game, seats[0], ctx.characters)).toBe(true);
		expect(mayNominate(session.game, seats[1], ctx.characters)).toBe(false);
	});

	it('lets a Banshee the Demon killed nominate', () => {
		const byDemon = castGame(['banshee', 'chef', 'imp'], die(0, 'demon'));
		expect(mayNominate(byDemon.session.game, byDemon.seats[0], byDemon.ctx.characters)).toBe(true);
		const byImp = castGame(['banshee', 'chef', 'imp'], die(0, 'imp'));
		expect(mayNominate(byImp.session.game, byImp.seats[0], byImp.ctx.characters)).toBe(true);
	});

	it('does not let an executed Banshee nominate', () => {
		const { session, ctx, seats } = castGame(['banshee', 'chef', 'imp'], die(0, 'execution'));
		expect(mayNominate(session.game, seats[0], ctx.characters)).toBe(false);
	});

	it('offers a Banshee whose death has no recorded cause', () => {
		const { session, ctx, seats } = castGame(['banshee', 'chef', 'imp'], die(0));
		expect(mayNominate(session.game, seats[0], ctx.characters)).toBe(true);
	});

	it('warns on a dead nominator, but not on a Banshee the Demon killed', () => {
		const warned = (cast: string[]) => {
			const { session, ctx, seats } = castGame(cast, die(0, 'demon'));
			const result = dispatch(session, nominate(0, 2)(seats), ctx);
			return result.ok ? result.warnings.map((w) => w.code) : [];
		};
		expect(warned(['chef', 'empath', 'imp'])).toContain('dead-nominator');
		expect(warned(['banshee', 'chef', 'imp'])).not.toContain('dead-nominator');
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
