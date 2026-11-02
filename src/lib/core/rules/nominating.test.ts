/**
 * Who may nominate, as data (M9c):
 * - https://wiki.bloodontheclocktower.com/Bishop: only the Storyteller nominates while the
 *   Bishop's ability works (`nominating.by`).
 * - https://wiki.bloodontheclocktower.com/Golem: the Golem may nominate once in the whole game
 *   (`nominating.perGame`).
 * - https://wiki.bloodontheclocktower.com/Gnome: when the Gnome's amigo is nominated, the Gnome
 *   may kill the nominator, as often as it happens (`onNominated.carrier`).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import {
	characterNominationPrompts,
	nominationsLeftThisGame,
	storytellerNominates
} from './nominations.ts';

const parse = (raw: unknown, reminders = ['Amigo']) => {
	const issues = new Issues();
	return { rules: parseCharacterRules(raw, 'rules', issues, reminders), issues: issues.list };
};

/** The warnings recording a nomination now would give. */
const nominating = (s: Scenario, by: SeatRef, nominee: SeatRef): string[] =>
	warned(s.session, s.ctx, { type: 'Nominate', nominator: s.seat(by), nominee: s.seat(nominee) });

describe('the nominating part', () => {
	it('reads only the Storyteller nominating, or a limit per game', () => {
		expect(parse({ nominating: { by: 'storyteller' } }).rules).toEqual({
			nominating: { by: 'storyteller' }
		});
		expect(parse({ nominating: { perGame: 1 } }).rules).toEqual({ nominating: { perGame: 1 } });
	});

	it('rejects both at once, neither, an unknown nominator or a count under 1', () => {
		expect(parse({ nominating: { by: 'storyteller', perGame: 1 } }).issues).toHaveLength(1);
		expect(parse({ nominating: {} }).issues).toHaveLength(1);
		expect(parse({ nominating: { by: 'player' } }).issues).toHaveLength(1);
		expect(parse({ nominating: { perGame: 0 } }).issues).toHaveLength(1);
		expect(parse({ nominating: { perGame: 1.5 } }).issues).toHaveLength(1);
		expect(parse({ nominating: 'storyteller' }).issues).toHaveLength(1);
	});
});

describe('the onNominated part with a carrier', () => {
	it('reads a reminder carrier and the may-kill effect, with no nominator type', () => {
		const onNominated = { carrier: 'Amigo', effect: 'may-kill-nominator' };
		expect(parse({ onNominated })).toEqual({ rules: { onNominated }, issues: [] });
	});

	it('rejects a carrier that is not one of the character’s reminders', () => {
		const onNominated = { carrier: 'Friend', effect: 'may-kill-nominator' };
		expect(parse({ onNominated }).issues).toEqual([
			'rules.onNominated.carrier: not one of this character’s reminders'
		]);
	});
});

describe('Bishop: only the Storyteller nominates', () => {
	it('warns on a nomination while the Bishop’s ability works, and still records it', () => {
		const s = scenario(['bishop', 'chef', 'empath', 'imp']);
		expect(storytellerNominates(s.game, s.characters)).toEqual(['bishop']);
		expect(nominating(s, 'chef', 'imp')).toEqual(['storyteller-nominates']);
		expect(s.nominate('chef', 'imp').game.today.entries).toHaveLength(1);
	});

	it('does not warn once the Bishop is dead or poisoned', () => {
		const s = scenario(['bishop', 'chef', 'empath', 'imp', 'poisoner']);
		expect(nominating(s.dies('bishop', 'execution'), 'chef', 'imp')).toEqual([]);
		expect(nominating(s.poisoned('bishop'), 'chef', 'imp')).toEqual([]);
		expect(storytellerNominates(s.poisoned('bishop').game, s.characters)).toEqual([]);
	});

	it('does not warn without a Bishop', () => {
		expect(nominating(scenario(['chef', 'empath', 'imp']), 'chef', 'imp')).toEqual([]);
	});
});

describe('Golem: may only nominate once per game', () => {
	it('keeps its day ability use (the nominated player dies unless the Demon)', () => {
		expect(rulesOf('golem')).toMatchObject({
			nominating: { perGame: 1 },
			dayUse: { who: 'nominated', kills: true, spentToken: 'May Not Nominate' }
		});
	});

	it('warns on a second nomination, on the same day or a later one', () => {
		const s = scenario(['golem', 'chef', 'empath', 'imp']);
		expect(nominationsLeftThisGame(s.game, s.seat('golem'), s.characters)).toEqual({
			characterId: 'golem',
			left: 1
		});
		expect(nominating(s, 'golem', 'chef')).toEqual([]);
		const once = s.nominate('golem', 'chef');
		expect(nominationsLeftThisGame(once.game, s.seat('golem'), s.characters)?.left).toBe(0);
		expect(nominating(once.newDay(), 'golem', 'imp')).toEqual(['nominated-this-game']);
	});

	it('counts its May Not Nominate reminder as the nomination made', () => {
		const s = scenario(['golem', 'chef', 'imp']).reminder('golem', 'golem', 'May Not Nominate');
		expect(nominating(s, 'golem', 'imp')).toEqual(['nominated-this-game']);
	});

	it('does not count the nomination being changed', () => {
		const s = scenario(['golem', 'chef', 'empath', 'imp'])
			.nominate('golem', 'chef')
			.reminder('golem', 'golem', 'May Not Nominate');
		const entry = s.game.today.entries[0];
		const edit: Command = {
			type: 'EditNomination',
			entryId: entry.entryId,
			nominator: s.seat('golem'),
			nominee: s.seat('empath')
		};
		expect(warned(s.session, s.ctx, edit)).toEqual([]);
	});

	it('sets no limit while the Golem is drunk, or for other players', () => {
		const s = scenario(['golem', 'chef', 'imp']).nominate('golem', 'chef');
		expect(nominationsLeftThisGame(s.drunk('golem').game, s.seat('golem'), s.characters)).toBe(
			undefined
		);
		expect(nominationsLeftThisGame(s.game, s.seat('chef'), s.characters)).toBe(undefined);
	});
});

describe('Gnome: may kill whoever nominates its amigo', () => {
	const amigo = () =>
		scenario(['gnome', 'chef', 'empath', 'imp', 'poisoner']).reminder('chef', 'gnome', 'Amigo');
	const prompts = (s: Scenario, by: SeatRef, nominee: SeatRef) =>
		characterNominationPrompts(
			s.game,
			{ nominator: s.seat(by), nominee: s.seat(nominee) },
			s.characters
		);

	it('offers the kill when the amigo is nominated, by any player', () => {
		const s = amigo();
		expect(prompts(s, 'imp', 'chef')).toEqual([
			{
				kind: 'may-kill-nominator',
				characterId: 'gnome',
				nominator: s.seat('imp'),
				nominee: s.seat('chef')
			}
		]);
		expect(prompts(s, 'empath', 'chef')).toHaveLength(1);
	});

	it('offers it again on a later day: the ability has no limit', () => {
		const s = amigo().nominate('imp', 'chef').newDay();
		expect(prompts(s, 'empath', 'chef')).toHaveLength(1);
	});

	it('offers nothing for another nominee, or while the Gnome is poisoned', () => {
		const s = amigo();
		expect(prompts(s, 'chef', 'empath')).toEqual([]);
		expect(prompts(s.poisoned('gnome'), 'imp', 'chef')).toEqual([]);
	});
});
