/**
 * Storm Catcher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Storm_Catcher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Storm Catcher.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { evilLearns, prepValueCharacter, prepValueKey } from '#lib/core/rules/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { stepInfoCards } from '#lib/core/rules/info-token-characters.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep, setupReminders } from '#lib/core/rules/setup-reminders.ts';

describe('Storm Catcher', () => {
	const character = committedCharacter('stormcatcher');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Storm Catcher');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Stormcaught']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('stormcatcher')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Storm_Catcher#Examples)', () => {
		it('Example 1: General survives night attacks until executed', () => {
			// Wiki: "The Storyteller has built a script based on the General, so says that “the
			// Storm Catcher favours the General”. The General is in play. At night, the Imp and the
			// Godfather both attack the General, who does not die. After 5 days of information and
			// discussion, the town decides to execute the General. They die."
			// The Stormcaught General can't die at night, to the Imp or the Godfather, only by
			// execution.
			const s = scenario(['general', 'imp', 'godfather', 'chef'])
				.rule('stormcatcher')
				.reminder('general', 'stormcatcher', 'Stormcaught');
			for (const by of ['demon', 'other'] as const) {
				expect(protection(s.game, s.seat('general'), s.characters, by)).toMatchObject({
					characterId: 'stormcatcher'
				});
			}
			expect(protection(s.game, s.seat('general'), s.characters, 'execution')).toBeUndefined();
			const after = s.execute('general');
			expect(after.game.seats[after.seat('general')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
		});

		it('Example 1 (continued): the evil players learn who the favoured General is', () => {
			// Wiki: "The Storyteller has built a script based on the General, so says that “the
			// Storm Catcher favours the General”. The General is in play. At night, the Imp and the
			// Godfather both attack the General, who does not die. After 5 days of information and
			// discussion, the town decides to execute the General. They die."
			// The General is marked Stormcaught: the Imp and Godfather are shown "This player is"
			// with the General, pointing at its player.
			const s = scenario(['general', 'imp', 'godfather', 'chef']).reminder(
				'general',
				'stormcatcher',
				'Stormcaught'
			);
			expect(evilLearns(s.game, 'stormcatcher', s.characters)).toEqual({
				evil: [s.seat('imp'), s.seat('godfather')],
				marked: { seatId: s.seat('general'), characterId: 'general' }
			});
		});

		it('Example 2: with the favoured Empath not in play, no one is marked', () => {
			// Wiki: "The Storyteller wants a game based around the Empath’s information, so
			// declares that “The Storm Catcher favours the Empath”. There is no Empath in play.
			// Because the evil players learn this, the Poisoner chooses to bluff as the Empath."
			// The evil players are shown the Empath as not in play, so the Poisoner may bluff it.
			const s = scenario(['poisoner', 'imp', 'chef']);
			expect(evilLearns(s.game, 'stormcatcher', s.characters)).toEqual({
				evil: [s.seat('poisoner'), s.seat('imp')]
			});
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Storm_Catcher#How_to_Run)', () => {
		it('asks at setup to name a good character, and marks only a good player', () => {
			// Wiki: "Declare which good character is favoured by the Storm Catcher. If the favoured
			// character is in play, mark them with the Storm Catcher’s SAFE reminder."
			const s = scenario(['general', 'chef', 'saint', 'poisoner', 'imp']).rule('stormcatcher');
			expect(setupPrep('stormcatcher', 'Storm Catcher', s.characters)).toContainEqual(
				expect.objectContaining({ value: expect.objectContaining({ key: 'named' }) })
			);
			const prep = setupReminders(s.game, s.characters).filter(
				(r) => r.characterId === 'stormcatcher'
			);
			expect(prep).toMatchObject([
				{ label: 'Stormcaught', candidates: [s.seat('general'), s.seat('chef'), s.seat('saint')] }
			]);
			const token = { characterId: 'stormcatcher', label: 'Stormcaught' };
			expect(reminderTargetMisses(s.game, token, s.seat('poisoner'), s.characters)).toEqual([
				'type'
			]);
		});

		it('shows the evil players the named character as not in play when no one is marked', () => {
			// Wiki: "If no one is marked with the Storm Catcher’s SAFE reminder, show the evil player
			// the THESE CHARACTERS ARE NOT IN PLAY info token and the good character token, then put
			// the evil player to sleep."
			const storm = committedCharacter('stormcatcher');
			expect(
				stepInfoCards(storm, storm.firstNightReminder, {
					prepValues: { [prepValueKey('stormcatcher', 'named')]: 'empath' }
				})
			).toMatchObject([{ token: { id: 'not-in-play' }, filled: { characterIds: ['empath'] } }]);
		});

		it("flags the Demon's attack and a day kill on the marked player as blocked", () => {
			// Wiki: "If they would die by other means, they remain alive."
			const s = scenario(['general', 'chef', 'poisoner', 'imp'])
				.rule('stormcatcher')
				.rule('doomsayer')
				.reminder('general', 'stormcatcher', 'Stormcaught');
			expect(nightStepAlerts(s.game, 'imp', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'protected',
					seatId: s.seat('general'),
					source: expect.objectContaining({ characterId: 'stormcatcher' })
				})
			);
			expect(dayUseDeath(s.game, 'doomsayer', s.seat('general'), s.characters)).toBe('maybe');
		});
	});

	describe('the named character, saved with the game (M10g)', () => {
		it('keeps the character named during prep, even when it is not in play', () => {
			// Trevor (2026-11-01): the stormcaught character is saved and logged in play or not.
			const s = scenario(['poisoner', 'imp', 'chef']).do({
				type: 'SetPrepValue',
				key: prepValueKey('stormcatcher', 'named'),
				value: 'empath'
			});
			expect(evilLearns(s.game, 'stormcatcher', s.characters)).toEqual({
				evil: [s.seat('poisoner'), s.seat('imp')],
				named: 'empath'
			});
			expect(prepValueCharacter('stormcatcher', 'named', s.characters)).toBe('good');
		});

		it('reads a character prep value, and refuses an unknown kind', () => {
			const issues = new Issues();
			const note = (value: object) => ({ setupPrep: { notes: [{ text: 'x', value }] } });
			expect(
				parseCharacterRules(note({ key: 'k', label: 'L', character: 'good' }), 'a', issues)
					?.setupPrep?.notes?.[0]?.value
			).toEqual({ key: 'k', label: 'L', character: 'good' });
			parseCharacterRules(note({ key: 'k', label: 'L', character: 'evil' }), 'b', issues);
			expect(issues.list).toEqual(['b.setupPrep.notes[0].value.character: unknown value "evil"']);
		});
	});
});
