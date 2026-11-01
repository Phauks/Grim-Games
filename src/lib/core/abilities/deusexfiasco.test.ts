/**
 * Deus ex Fiasco: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Deus ex Fiasco.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { gameEnds, promptable, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { infoPicker, isAllowed, isTruthful, nightAnswer } from '#lib/core/rules/night-info.ts';
import { type Scenario, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Deus ex Fiasco', () => {
	const character = committedCharacter('deusexfiasco');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition carousel', () => {
			expect(character.name).toBe('Deus ex Fiasco');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Whoopsie']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('deusexfiasco')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco#Examples)', () => {
		// The Deus ex Fiasco's day line ("has not happened yet") shows until a Whoopsie is placed.
		const awaitsMistake = (at: Scenario) =>
			dayReminders(
				dayStateFromGame(at.game, (id) => at.characters.get(id), undefined, at.characters)
			)
				.groups.flatMap((g) => g.reminders)
				.some((r) => r.characterId === 'deusexfiasco');
		const whoopsie = (at: Scenario) =>
			at.do({
				type: 'AddRuleReminder',
				characterId: 'deusexfiasco',
				reminder: { characterId: 'deusexfiasco', label: 'Whoopsie' }
			});

		it('Example 1: Mayor shown; Ravenkeeper secretly made Drunk', () => {
			// Wiki: "During the first day, Doug talks privately with the Storyteller and says that he drew
			// the Drunk token from the bag. The Storyteller looks in the Grimoire and notices that Doug’s
			// token is the Drunk. The Storyteller tells Doug that he is now the Mayor, replaces the Drunk
			// token with the Mayor token in the Grimoire, and secretly makes the Ravenkeeper the Drunk
			// instead. Later that day, the Storyteller declares that a mistack has been madde."
			const s = scenario(['drunk', 'ravenkeeper', 'imp', 'chef', 'poisoner'])
				.rule('deusexfiasco')
				.newDay()
				.becomes('drunk', 'mayor')
				.drunk('ravenkeeper');
			expect(s.game.seats[s.seat('drunk')].characterId).toBe('mayor');
			expect(abilityState(s.game, s.seat('drunk'), s.characters).works).toBe(true);
			expect(abilityState(s.game, s.seat('ravenkeeper'), s.characters).works).toBe(false);
			expect(awaitsMistake(s)).toBe(true);
			expect(awaitsMistake(whoopsie(s))).toBe(false);
		});
		it('Example 2: Empath given wrong number, fixed next night', () => {
			// Wiki: "The Empath is sitting next to the Monk and the poisoned Recluse. The Storyteller,
			// forgetting that the Recluse is poisoned, accidentally gives the Empath a “1”. Later that
			// night, the Storyteller wakes the Empath again and gives a “0”. The following day, when the
			// Empath privately asks what happened, the Storyteller explains that the first number was a
			// mistake, and the second number is correct. To avoid revealing too much, the Storyteller
			// waits until the next day to inform the group that a mistake was made."
			// A poisoned Recluse registers truly, as good: the Empath's true number is 0.
			const s = scenario(['empath', 'monk', 'imp', 'poisoner', 'recluse'])
				.rule('deusexfiasco')
				.poisoned('recluse');
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(false);
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
			const told = s.newDay().newDay();
			expect(awaitsMistake(told)).toBe(true);
			expect(awaitsMistake(whoopsie(told))).toBe(false);
		});
		it('Example 3: Undertaker shown wrong token, corrected next night', () => {
			// Wiki: "The Imp was executed today. The Storyteller wakes the sober & healthy Undertaker,
			// and deliberately (and incorrectly) shows the Recluse token. Later that night, the
			// Storyteller again wakes the Undertaker and shows the Imp token. In the morning, the
			// Storyteller tells the group that a mistake was made in the night, but corrected."
			const s = scenario(['undertaker', 'recluse', 'imp', 'scarletwoman', 'chef', 'monk'])
				.rule('deusexfiasco')
				.execute('imp');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'imp'
			});
			expect(awaitsMistake(whoopsie(s.newDay()))).toBe(false);
		});
		it('Example 4: Premature game-over call; Scarlet Woman lives', () => {
			// Wiki: "The Yaggababble is executed and dies. The Storyteller accidentally declares that the
			// game is over and good has wun. However, the Scarlet Woman is still alive. The Storyteller
			// declares that a mistake has been made, and that the game continus."
			// With five players alive the Scarlet Woman becomes the Demon, so the game goes on.
			const s = scenario(['yaggababble', 'scarletwoman', 'chef', 'monk', 'empath', 'soldier'])
				.rule('deusexfiasco')
				.execute('yaggababble');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([
				{
					rule: 'demon-dead',
					holds: [{ rule: 'becomes-demon', characterId: 'scarletwoman' }]
				}
			]);
			expect(promptable(ends)).toEqual([]);
			expect(suggestedWinner(ends)).toBeUndefined();
			expect(awaitsMistake(whoopsie(s))).toBe(false);
		});
		it('Example 5: Wrong deaths announced for two players', () => {
			// Wiki: "Ben is the Shabaloth. At night, Ben kills Amy and Doug. In the morning, the
			// Storyteller deliberately declares that Ben and Lewis have died. After 30 seconds or so, the
			// Storyteller says “Whoops, I had my Grimoire facing the wrong way. Ben and Lewis should not
			// have died. They are still alive. Amy and Doug died during the night. Sorry, my mistake.”"
			const announced = scenario(['chef', 'shabaloth', 'monk', 'empath', 'poisoner', 'soldier'])
				.rule('deusexfiasco')
				.newDay()
				.dies('shabaloth')
				.dies('poisoner');
			const s = whoopsie(
				announced.do(
					(at) => ({ type: 'SetDead', seatId: at.seat('shabaloth'), dead: false }),
					(at) => ({ type: 'SetDead', seatId: at.seat('poisoner'), dead: false })
				)
			)
				.dies('chef', 'shabaloth')
				.dies('empath', 'shabaloth');
			const dead = s.game.seating.filter((id) => s.game.seats[id].dead);
			expect(dead).toEqual([s.seat('chef'), s.seat('empath')]);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			expect(awaitsMistake(s)).toBe(false);
		});
		it('Example 6: Poisoner missed a wake; gets extra targets', () => {
			// Wiki: "The Storyteller forgot to wake the Poisoner last night. The Storyteller has a private
			// chat with the Poisoner, tells them this, and tells them that every night from now on, they
			// can choose as many players as they want, and the Storyteller will choose which of these
			// players are poisoned."
			// The Storyteller poisons two of the players the Poisoner chose.
			const s = scenario(['poisoner', 'chef', 'empath', 'monk', 'imp', 'soldier'])
				.rule('deusexfiasco')
				.newDay()
				.newDay()
				.poisoned('chef')
				.poisoned('empath');
			expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(false);
			expect(abilityState(s.game, s.seat('empath'), s.characters).works).toBe(false);
			expect(abilityState(s.game, s.seat('monk'), s.characters).works).toBe(true);
		});
		it('Example 7: Chambermaid picks dead player; wrong info given', () => {
			// Wiki: "The Chambermaid wakes and chooses a dead player, even though the Chambermaid must
			// only choose living players. The Storyteller notices this, but does not correct the
			// Chambermaid. Instead, the Storyteller deliberately gives false information to the
			// Chambermaid. The next day, the Storyteller requests a private chat with the Chambermaid,
			// tells them that they made a mistake by allowing them to choose a dead player, and prompts
			// them to choose two living players immediately. The Storyteller gives correct information
			// this time."
			const s = scenario(['chambermaid', 'chef', 'empath', 'imp', 'poisoner', 'soldier'])
				.rule('deusexfiasco')
				.newDay()
				.dies('chef', 'imp');
			const picker = infoPicker(s.game, s.seat('chambermaid'), 'chambermaid', s.characters)!;
			expect(picker.options.some((o) => o.seats.includes(s.seat('chef')))).toBe(false);
			expect(picker.options.some((o) => o.seats.includes(s.seat('soldier')))).toBe(true);
		});
	});
});
