/**
 * Vortox: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vortox
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vortox.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { castGame, castWith, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import {
	answerOptions,
	infoPicker,
	isAllowed,
	nightAnswer,
	reliability
} from '#lib/core/rules/night-info.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { savantSituation } from '#lib/core/rules/savant.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Vortox', () => {
	const character = committedCharacter('vortox');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Vortox');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('vortox')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vortox#Examples)', () => {
		it('Example 1: Vortox kills Sage; Sage sees non-Demons', () => {
			// Wiki: "The Vortox kills the Sage. The Sage learns two players, both of which are not Demons."
			const s = scenario(['sage', 'chef', 'vortox', 'witch', 'empath']).dies('sage', 'vortox');
			const picker = infoPicker(s.game, s.seat('sage'), 'sage', s.characters)!;
			expect(picker.mustBeFalse).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef'), s.seat('empath')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('vortox'), s.seat('chef')] })).toBe(false);
		});

		it("Example 2: Mutant's execution: two Townsfolk say yes", () => {
			// Wiki: "Nobody voted or nominated today, but the Mutant is executed. That night, both the
			// Flowergirl and the Town Crier learn a "yes.”"
			// The Storyteller marks that the Demon didn't vote and no Minion nominated.
			const s = scenario(['flowergirl', 'towncrier', 'mutant', 'vortox', 'witch', 'chef'])
				.execute('mutant')
				.do({ type: 'SetDayMark', mark: 'demon-voted', value: false })
				.do({ type: 'SetDayMark', mark: 'minion-nominated', value: false });
			for (const id of ['flowergirl', 'towncrier']) {
				const a = nightAnswer(s.game, s.seat(id), id, s.characters)!;
				expect(a).toMatchObject({ kind: 'yes-no', value: false, mustBeFalse: true });
				expect(answerOptions(s.game, a, s.characters)).toEqual([
					{ reason: 'invalid', value: { kind: 'yes-no', value: false } },
					{ reason: 'false-info', value: { kind: 'yes-no', value: true } }
				]);
			}
		});

		it('Example 3: Dreamer narrows Savant to two characters', () => {
			// Wiki: "The Savant is in play, and learns two pieces of information each day. Both are false.
			// That night, the Dreamer chooses a player who is the Savant, and learns that player is either the
			// Philosopher or the No Dashii."
			const s = scenario(['savant', 'dreamer', 'chef', 'vortox', 'witch']);
			expect(savantSituation(s.game, s.seat('savant'), s.characters)).toMatchObject({
				mode: 'both-false',
				falseSeat: s.seat('vortox')
			});
			// The Dreamer's information is false too: the Savant's own character may not be shown,
			// and the Philosopher and No Dashii, both wrong, may.
			const picker = infoPicker(s.game, s.seat('dreamer'), 'dreamer', s.characters)!;
			expect(picker.mustBeFalse).toBe(true);
			const savant = [s.seat('savant')];
			expect(isAllowed(picker, { seats: savant, characterId: 'savant' })).toBe(false);
			for (const characterId of ['philosopher', 'nodashii']) {
				expect(isAllowed(picker, { seats: savant, characterId })).toBe(true);
			}
		});

		it("Example 4: Pit-Hag's change gives Juggler true info", () => {
			// Wiki: "The Pit-Hag turns the Juggler into the Witch. The Juggler learns that they are now the
			// good Witch, because this information comes from the Pit-Hag's ability, not a Townsfolk's
			// ability."
			const s = scenario(['juggler', 'pithag', 'vortox', 'chef', 'empath']);
			expect(reliability(s.game, s.seat('juggler'), 'juggler', s.characters).mustBeFalse).toBe(
				true
			);
			const after = s.becomes('juggler', 'witch');
			expect(after.game.seats[after.seat('juggler')].alignment).toBe('good');
			// What the Pit-Hag's ability tells them, a Minion's, need not be false.
			expect(
				reliability(after.game, after.seat('juggler'), 'pithag', after.characters).mustBeFalse
			).toBeUndefined();
		});
		it('Example 5: Nobody executed, so evil wins', () => {
			// Wiki: "Today, a player died from the Witch, two Travellers were exiled, 5 nominations happened,
			// but nobody was executed. Evil wins."
			const s = scenario(['chef', 'empath', 'monk', 'witch', 'vortox']).newDay();
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'day-without-execution', winner: 'evil' }
			]);
		});
	});

	describe('Townsfolk information is false (its falseInfo rule)', () => {
		it('a Townsfolk must be given false information; an Outsider need not', () => {
			const { game: g, seats } = castGame(['chef', 'recluse', 'vortox', 'poisoner', 'monk']);
			expect(reliability(g, seats[0], 'chef', testCharacters)).toMatchObject({
				mustBeFalse: true,
				falseSeat: seats[2],
				falseBy: 'vortox'
			});
			expect(reliability(g, seats[1], 'recluse', testCharacters).mustBeFalse).toBeUndefined();
		});

		it('a poisoned Vortox makes nothing false', () => {
			const { game: g, seats } = castGame(
				['chef', 'empath', 'vortox', 'poisoner', 'monk'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[2],
					reminder: { characterId: 'poisoner', label: 'Poisoned' }
				})
			);
			expect(reliability(g, seats[0], 'chef', testCharacters).mustBeFalse).toBeUndefined();
		});

		it('a custom character with the same rule makes its types false', () => {
			const issues = new Issues();
			const fog = parseCharacter(
				{
					id: 'fogbank',
					name: 'Fogbank',
					team: 'minion',
					ability: 'Outsider abilities yield false info.',
					rules: { falseInfo: { types: ['outsider'] } }
				},
				'[0]',
				issues,
				{ strict: false, scriptFields: true }
			);
			expect(issues.list).toEqual([]);
			const all = new Map([...testCharacters, [fog!.id, fog!]]);
			const { game: g, seats } = castWith({ characters: all })([
				'chef',
				'recluse',
				'imp',
				'fogbank',
				'monk'
			]);
			expect(reliability(g, seats[1], 'recluse', all)).toMatchObject({
				mustBeFalse: true,
				falseBy: 'fogbank'
			});
			expect(reliability(g, seats[0], 'chef', all).mustBeFalse).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Vortox#How_to_Run)', () => {
		it('a dead Vortox no longer makes Townsfolk information false', () => {
			// Wiki: "While the Vortox is alive, you must give false information whenever a Townsfolk
			// ability prompts you to give information."
			const s = scenario(['chef', 'empath', 'vortox', 'witch', 'monk']);
			expect(reliability(s.game, s.seat('empath'), 'empath', s.characters).mustBeFalse).toBe(true);
			const dead = s.execute('vortox');
			expect(
				reliability(dead.game, dead.seat('empath'), 'empath', dead.characters).mustBeFalse
			).toBeUndefined();
		});

		it('kills one player each night after the first, marked Dead', () => {
			// Wiki: "Each night except the first, wake the Vortox. They point at any player. That player
			// dies - mark them with the DEAD reminder."
			expect(placeholdersFor(character, 'first')).toBeUndefined();
			expect(placeholdersFor(character, 'other')).toEqual([
				{ tokens: [{ label: 'Dead', action: 'place' }] }
			]);
			const s = scenario(['chef', 'empath', 'vortox', 'witch', 'monk']).newDay();
			expect(nightKill(s.game, s.seat('vortox'), 'vortox', s.characters)?.max).toBe(1);
			const dead = { characterId: 'vortox', label: 'Dead' };
			expect(reminderTargets(s.game, dead, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});

		it('a day with an execution does not end the game at dusk', () => {
			// Wiki: "Each dusk, if no player was executed today, the game ends and the evil team wins."
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'witch', 'vortox'])
				.newDay()
				.nominate('chef', 'monk')
				.execute('monk');
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toEqual([]);
		});
	});
});
