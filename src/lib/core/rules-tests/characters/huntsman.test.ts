/**
 * Huntsman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Huntsman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Huntsman.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/abilities/becomes.ts';
import { nightAnswer } from '#lib/core/rules/night/info/answers.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { decide } from '#lib/core/engine/index.ts';
import { filledInfoToken } from '#lib/core/rules/night/info-token-characters.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';

describe('Huntsman', () => {
	const character = committedCharacter('huntsman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Huntsman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('huntsman')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Huntsman#Examples)', () => {
		it('Example 1: Late correct pick turns Damsel into Undertaker', () => {
			// Wiki: "The Huntsman is woken on the 1st night, but does not use their ability. On the
			// second night, the Huntsman chooses the Damsel player. The Damsel becomes the Undertaker and
			// learns which player died today."
			const s = scenario(['huntsman', 'damsel', 'chef', 'empath', 'poisoner', 'imp'])
				.newDay()
				.execute('chef');
			expect(characterChanger(s.game, 'huntsman', s.characters)).toBe(s.seat('huntsman'));
			expect(changeableSeats(s.game, 'huntsman', s.characters)).toEqual([s.seat('damsel')]);
			const after = s
				.becomes('damsel', 'undertaker')
				.reminder('huntsman', 'huntsman', 'No Ability');
			expect(
				nightAnswer(after.game, after.seat('damsel'), 'undertaker', after.characters)
			).toMatchObject({ kind: 'character', value: 'chef' });
			expect(characterChanger(after.game, 'huntsman', after.characters)).toBeUndefined();
		});
		it('Example 2: Wrong guess; Huntsman stops waking at night', () => {
			// Wiki: "The Huntsman chooses Lachlan. Lachlan is the General, so nothing happens. The
			// Huntsman is no longer woken at night."
			const s = scenario(['huntsman', 'general', 'damsel', 'empath', 'poisoner', 'imp']);
			// Only the Damsel's player can change.
			expect(changeableSeats(s.game, 'huntsman', s.characters)).not.toContain(s.seat('general'));
			const spent = s.reminder('huntsman', 'huntsman', 'No Ability');
			expect(characterChanger(spent.game, 'huntsman', spent.characters)).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Huntsman#How_to_Run)', () => {
		const data = committedGameData();
		const get = (ids: string[]) => ids.map((id) => data.byId.get(id)!);
		const setup = (ids: string[]) =>
			analyseSetup({ players: 7, inPlay: get(ids), findById: (id) => data.byId.get(id) });

		it('asks for the Damsel in place of a Townsfolk when she is not in play', () => {
			// Wiki: "While setting up the game, before putting character tokens in the bag, if the
			// Damsel is not already in play, remove a Townsfolk character token and add the Damsel
			// character token."
			const without = setup(['huntsman', 'chef', 'empath', 'monk', 'mayor', 'poisoner', 'imp']);
			expect(without.warnings).toContainEqual(
				expect.objectContaining({ code: 'missing-required', characters: ['huntsman', 'damsel'] })
			);
			const withDamsel = setup(['huntsman', 'chef', 'empath', 'monk', 'damsel', 'poisoner', 'imp']);
			expect(withDamsel.warnings).toEqual([]);
			expect(withDamsel.chosen).toMatchObject({ townsfolk: 4, outsider: 1 });
		});

		it('marks the Huntsman No Ability at its step once they choose a player', () => {
			// Wiki: "If they point to a player, put the Huntsman to sleep. The Huntsman loses their
			// ability—mark them with the NO ABILITY reminder and remove their night token from the night
			// sheet."
			for (const night of ['first', 'other'] as const) {
				const placeholders = placeholdersFor(character, night);
				const reminder =
					night === 'first' ? character.firstNightReminder! : character.otherNightReminder!;
				const text = nightTextPlain(
					nightTextSegments(reminder, character, { ...(placeholders ? { placeholders } : {}) })
				);
				expect(text).toContain('[+No Ability]');
			}
			const s = scenario(['huntsman', 'general', 'damsel', 'empath', 'poisoner', 'imp']);
			const spent = { characterId: 'huntsman', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, spent, s.seat('huntsman'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('general'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('shows the Damsel You are with a Townsfolk that is not in play', () => {
			// Wiki: "If they chose the Damsel, wake the Damsel, show the YOU ARE info token, then a
			// not-in-play Townsfolk token, then put the Damsel to sleep. The Damsel now has this
			// Townsfolk ability, so replace the Damsel character token with this Townsfolk character
			// token."
			expect(rulesOf('huntsman', data.byId)?.changesCharacter).toMatchObject({
				types: ['townsfolk'],
				notInPlay: true,
				onlyFrom: ['damsel']
			});
			const s = scenario(['huntsman', 'chef', 'damsel', 'empath', 'poisoner', 'imp']);
			const inPlay = decide(
				s.game,
				{ type: 'AssignCharacter', seatId: s.seat('damsel'), characterId: 'chef' },
				s.ctx
			);
			expect(inPlay.ok && inPlay.warnings.map((w) => w.code)).toContain('already-in-play');
			const after = s.becomes('damsel', 'undertaker');
			expect(after.game.seats[after.seat('damsel')].characterId).toBe('undertaker');
			expect(filledInfoToken(character, 'you-are', 1)).toBeDefined();
		});
	});
});
