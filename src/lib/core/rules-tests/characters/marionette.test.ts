/**
 * Marionette: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Marionette
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Marionette.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/abilities/becomes.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end/game-end.ts';
import { answerOptions, nightAnswer } from '#lib/core/rules/night/info/answers.ts';
import { infoPicker } from '#lib/core/rules/night/info/picker.ts';
import { reliability } from '#lib/core/rules/night/info/reliability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { isReplacedAfterDraw } from '#lib/core/rules/setup/bag-characters.ts';
import { filledInfoToken } from '#lib/core/rules/night/info-token-characters.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';

describe('Marionette', () => {
	const character = committedCharacter('marionette');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Marionette');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Marionette']);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('marionette')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	// With three Minions, one more Minion token is swapped for a Townsfolk, and on the first night
	// a good player becomes that Minion (M22).
	// Wiki (How to Run): "If there are three Minions in play, remove another Minion token and add
	// another Townsfolk token. During the first night, swap a good player’s character token with a
	// not-in-play Minion character token."
	describe('with three Minions', () => {
		const good = ['chef', 'empath', 'monk', 'mayor', 'washerwoman', 'librarian', 'investigator'];
		const thirteen = [
			...good,
			'fortuneteller',
			'undertaker',
			'ravenkeeper',
			'imp',
			'poisoner',
			'soldier'
		];

		it('lets one Minion fewer be dealt only when there are usually three', () => {
			const s = scenario(['chef', 'imp']);
			const get = (ids: string[]) => ids.map((id) => s.characters.get(id)!);
			const big = analyseSetup({ players: 13, inPlay: get([...thirteen.slice(1), 'marionette']) });
			expect(big.expected.minion).toEqual([2, 3]);
			const small = analyseSetup({
				players: 7,
				inPlay: get(['chef', 'empath', 'monk', 'mayor', 'saint', 'imp', 'marionette'])
			});
			expect(small.expected.minion).toEqual([1]);
		});

		it('makes the missing Minion from a good player on the first night', () => {
			// Thirteen players usually have three Minions: the Marionette and the Poisoner are two.
			const s = scenario(thirteen).reminder('chef', 'marionette', 'Is The Marionette');
			expect(characterChanger(s.game, 'marionette', s.characters)).toBe(s.seat('chef'));
			const offered = changeableSeats(s.game, 'marionette', s.characters);
			expect(offered).not.toContain(s.seat('imp'));
			expect(offered).not.toContain(s.seat('poisoner'));
			expect(offered).not.toContain(s.seat('chef'));
			const after = s.becomes('monk', 'spy', 'evil');
			expect(characterChanger(after.game, 'marionette', after.characters)).toBeUndefined();
		});

		it('makes none with fewer Minions usual', () => {
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'saint', 'imp', 'soldier']).reminder(
				'chef',
				'marionette',
				'Is The Marionette'
			);
			expect(characterChanger(s.game, 'marionette', s.characters)).toBeUndefined();
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Marionette#Examples)', () => {
		it('Example 1: Marionette thinks they are the Undertaker', () => {
			// Wiki: "Marianna is the Marionette, but thinks she is the Undertaker. She wakes each night to
			// learn who was executed that day, but her information is often wrong. Halfway through the
			// game, the Demon tells her that she is the Marionette."
			// She sits beside the Demon, shown the Undertaker, with the Marionette's reminder.
			// Waits on the engine (M15n): Is The Marionette gives no impairment for the good character they think they are, so their info counts as reliable.
			const s = scenario(['undertaker', 'imp', 'chef', 'empath', 'monk', 'poisoner'])
				.reminder('undertaker', 'marionette', 'Is The Marionette')
				.execute('chef');
			expect(trueCharacter(s.game, s.seat('undertaker'), s.characters)).toBe('marionette');
			expect(typeOf(s.game, s.seat('undertaker'), s.characters)).toBe('minion');
			// She has no Undertaker ability, so her information need not be true.
			const r = reliability(s.game, s.seat('undertaker'), 'undertaker', s.characters);
			expect(r).toMatchObject({
				unreliable: 'no-ability',
				impairments: [{ reason: 'no-ability', source: { characterId: 'marionette' } }]
			});
			// So any answer may be given, not only the Chef.
			const a = nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)!;
			expect(answerOptions(s.game, a, s.characters)[0]).toMatchObject({
				reason: 'true',
				value: { kind: 'character', value: 'chef' }
			});
			expect(answerOptions(s.game, a, s.characters).length).toBeGreaterThan(1);
		});
		it('Example 2: Demon bluffs that another player is Marionette', () => {
			// Wiki: "Lachlan is the Demon. He tells Sarah that she is the Marionette. Lachlan is lying.
			// There is no Marionette."
			// Sarah is the real Chef: nothing marks her, and her information is true.
			const s = scenario(['chef', 'imp', 'empath', 'monk', 'poisoner']);
			expect(trueCharacter(s.game, s.seat('chef'), s.characters)).toBe('chef');
			expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(true);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.anyAllowed).toBe(false);
		});
		it('Example 3: Claim rejected; good wins', () => {
			// Wiki: "The Demon tells Ben that he is the Marionette. Ben thinks he is the Fortune Teller, but
			// he isn’t. Ben doesn’t believe the Demon, and executes them. Good wins."
			// Ben is the Marionette, shown the Fortune Teller; executing the Demon ends the game.
			const s = scenario(['fortuneteller', 'imp', 'chef', 'empath', 'monk', 'mayor'])
				.reminder('fortuneteller', 'marionette', 'Is The Marionette')
				.newDay()
				.execute('imp');
			expect(trueCharacter(s.game, s.seat('fortuneteller'), s.characters)).toBe('marionette');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Marionette#How_to_Run)', () => {
		const cast = ['chef', 'imp', 'empath', 'monk', 'poisoner', 'mayor'];

		it('puts a Townsfolk in the bag in place of the Marionette', () => {
			// Wiki: "While setting up the game, before putting tokens in the bag, remove the Marionette
			// token and add any Townsfolk token."
			expect(isReplacedAfterDraw(character)).toBe(true);
			const s = scenario(cast);
			expect(setupPrep('marionette', character.name, s.characters)).toMatchObject([
				{ tokens: ['Is The Marionette'] }
			]);
		});

		it('puts Is The Marionette only on a good neighbour of the Demon', () => {
			// Wiki: "During the first night, mark a good player neighboring the Demon with the IS THE
			// MARIONETTE reminder."
			const s = scenario(cast);
			const token = { characterId: 'marionette', label: 'Is The Marionette' };
			expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('empath'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('monk'), s.characters)).toEqual([
				'neighbour'
			]);
		});

		it('shows the Demon the Marionette token on This player is', () => {
			// Wiki: "Wake the Demon. Point to the player marked IS THE MARIONETTE and show the
			// Marionette character token. Put the Demon to sleep."
			expect(filledInfoToken(character, 'this-player-is', 1)).toMatchObject({
				characterIds: ['marionette']
			});
		});
	});
});
