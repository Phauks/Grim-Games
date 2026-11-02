/**
 * Fisherman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fisherman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fisherman.
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
import {
	dayReminders,
	dayStateFromGame,
	isOnceOnlyDayAbility,
	renderReminder
} from '#lib/core/rules/day-reminders.ts';
import { infoPicker } from '#lib/core/rules/night-info.ts';
import { type Scenario, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Fisherman', () => {
	const character = committedCharacter('fisherman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Fisherman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('fisherman')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fisherman#Examples)', () => {
		// The Fisherman's day lines, as plain text.
		const linesOf = (at: Scenario) =>
			dayReminders(
				dayStateFromGame(at.game, (id) => at.characters.get(id), undefined, at.characters)
			)
				.groups.flatMap((g) => g.reminders)
				.filter((r) => r.characterId === 'fisherman')
				.map((r) => renderReminder(r.segments));

		it('Example 1: Advice: distrust a misled Empath', () => {
			// Wiki: "The Fisherman visits the Storyteller and learns that “You shouldn’t trust Ben”. Ben
			// is the poisoned Empath, and is unknowingly spreading false information."
			const s = scenario(['fisherman', 'empath', 'imp', 'poisoner', 'chef'])
				.poisoned('empath')
				.newDay();
			const empath = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(empath.anyAllowed).toBe(true);
			expect(abilityState(s.game, s.seat('fisherman'), s.characters).works).toBe(true);
			expect(isOnceOnlyDayAbility('fisherman', s.characters)).toBe(true);
			expect(linesOf(s)).toEqual(['[fisherman · Ana] may ask for advice']);
			const used = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('fisherman'),
				characterId: 'fisherman'
			}));
			expect(linesOf(used)).toEqual([]);
		});
		it('Example 2: Advice: protect players claiming Outsider', () => {
			// Wiki: "The Fisherman learns “Keep the players claiming to be Outsiders alive”. These players
			// are secretly the Klutz and the Fearmonger. The Storyteller believes that keeping these
			// players alive is more likely to end up with good executing the Demon."
			const s = scenario(['fisherman', 'klutz', 'fearmonger', 'imp', 'chef', 'monk']).newDay();
			expect(abilityState(s.game, s.seat('fisherman'), s.characters).works).toBe(true);
			expect(linesOf(s)).toHaveLength(1);
		});
		it('Example 3: Drunk Fisherman told to execute a Townsfolk', () => {
			// Wiki: "On the final day, the Fisherman learns to “kill Lewis”. The Fisherman is drunk, and
			// Lewis is a Townsfolk. The Storyteller gave bad (“false”) advice to the Fisherman."
			const s = scenario(['fisherman', 'chef', 'imp', 'poisoner', 'monk'])
				.drunk('fisherman')
				.newDay();
			expect(abilityState(s.game, s.seat('fisherman'), s.characters).works).toBe(false);
			// The day line warns that the advice is unreliable: the Fisherman is really the Drunk.
			expect(linesOf(s)).toEqual(['[fisherman · Ana] is really the [drunk · Ana]']);
		});
	});
});
