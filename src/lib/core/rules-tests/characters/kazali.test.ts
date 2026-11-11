/**
 * Kazali: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Kazali
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Kazali.
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
import { alignmentOf } from '#lib/core/model/selectors.ts';
import {
	changeableSeats,
	characterChanger,
	minionsLeft
} from '#lib/core/rules/abilities/becomes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { filledInfoToken } from '#lib/core/rules/night/info-token-characters.ts';
import { nightKill } from '#lib/core/rules/night/night-kill.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';

describe('Kazali', () => {
	const character = committedCharacter('kazali');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Kazali');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('kazali')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Kazali#Examples)', () => {
		it('Example 1: Kazali turns three players into Minions', () => {
			// Wiki: "There are 15 players and no Minions in play yet. The Kazali wakes and chooses that
			// Doug becomes the evil Organ Grinder, that Amy becomes the evil Vizier, and that Lewis becomes
			// the evil Goblin."
			// A scenario seats at most 12, so twelve players and two Minions to make, not three.
			const s = scenario([
				'kazali',
				'chef',
				'empath',
				'monk',
				'mayor',
				'washerwoman',
				'librarian',
				'investigator',
				'fortuneteller',
				'undertaker',
				'soldier',
				'virgin'
			]);
			expect(minionsLeft(s.game, s.characters)).toBe(2);
			expect(characterChanger(s.game, 'kazali', s.characters)).toBe(s.seat('kazali'));
			expect(changeableSeats(s.game, 'kazali', s.characters)).not.toContain(s.seat('kazali'));
			const one = s.becomes('chef', 'organgrinder', 'evil');
			expect(minionsLeft(one.game, one.characters)).toBe(1);
			expect(changeableSeats(one.game, 'kazali', one.characters)).not.toContain(one.seat('chef'));
			const two = one.becomes('empath', 'vizier', 'evil');
			expect(alignmentOf(two.game, two.seat('empath'))).toBe('evil');
			expect(minionsLeft(two.game, two.characters)).toBe(0);
			expect(characterChanger(two.game, 'kazali', two.characters)).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Kazali#How_to_Run)', () => {
		const cast = ['kazali', 'chef', 'empath', 'monk', 'mayor', 'saint', 'soldier'];

		it('deals no Minions and lets the Outsider count change', () => {
			// Wiki: "While setting up the game, remove all Minion tokens and add Townsfolk or Outsider
			// tokens."
			const s = scenario(cast);
			const result = analyseSetup({
				players: 7,
				inPlay: cast.map((id) => s.characters.get(id)!)
			});
			expect(result.expected.minion).toEqual([0]);
			expect(result.expected.outsider).toEqual(expect.arrayContaining([0, 1, 2]));
			expect(result.warnings).toEqual([]);
		});

		it('turns the chosen players into evil Minions not in play on the first night only', () => {
			// Wiki: "During the first night, wake the Kazali. The Kazali points at a player and a Minion
			// on the character sheet. Replace their old character token with the Minion token, show them
			// the “You Are” info token then the Minion character token, and give a thumbs down. Repeat
			// until the normal number of Minions exist. Put the Kazali to sleep."
			const s = scenario(cast);
			expect(rulesOf('kazali', s.characters)?.changesCharacter).toMatchObject({
				types: ['minion'],
				notInPlay: true,
				alignment: 'evil',
				firstNight: true
			});
			expect(characterChanger(s.game, 'kazali', s.characters)).toBe(s.seat('kazali'));
			expect(filledInfoToken(character, 'you-are', 1)).toBeDefined();
			const later = s.newDay();
			expect(characterChanger(later.game, 'kazali', later.characters)).toBeUndefined();
		});

		it('kills the player the Kazali points at on each night after the first', () => {
			// Wiki: "Each night except the first, wake the Kazali. They point at any player. That player
			// dies."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Dead]');
			const s = scenario(cast).newDay().dusk();
			expect(nightKill(s.game, s.seat('kazali'), 'kazali', s.characters)).toEqual({
				max: 1,
				delayed: []
			});
			const dead = { characterId: 'kazali', label: 'Dead' };
			expect(reminderTargetMisses(s.game, dead, s.seat('kazali'), s.characters)).toEqual([]);
		});
	});
});
