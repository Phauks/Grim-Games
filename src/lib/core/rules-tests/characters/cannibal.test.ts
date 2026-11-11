/**
 * Cannibal: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Cannibal
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Cannibal.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { registrations } from '#lib/core/rules/abilities/registration.ts';
import {
	gainedAbilities,
	hasAbilityOf,
	withGainedSteps
} from '#lib/core/rules/abilities/gained-abilities.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night/info/picker.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

describe('Cannibal', () => {
	const character = committedCharacter('cannibal');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Cannibal');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned', 'Lunch']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('cannibal')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Cannibal#Examples)', () => {
		it('Example 1: Ate Clockmaker: gets a distance number', () => {
			// Wiki: "The Clockmaker is executed and dies. That night, the Cannibal learns a “2” because
			// the Demon and Minion are two steps apart."
			const s = scenario(['cannibal', 'clockmaker', 'imp', 'chef', 'poisoner'])
				.execute('clockmaker')
				.newDay();
			const picker = infoPicker(s.game, s.seat('cannibal'), 'clockmaker', s.characters)!;
			expect(picker.range?.truth).toBe(2);
			expect(gainedAbilities(s.game, s.characters)).toContainEqual(
				expect.objectContaining({ seatId: s.seat('cannibal'), characterId: 'clockmaker' })
			);
		});
		it('Example 2: Poisoned Cannibal misled after eating Widow', () => {
			// Wiki: "It is the third night and the Widow was executed today. Because the Widow was
			// bluffing as the Fortune Teller, the Cannibal is prompted to choose 2 players, but they
			// learn a “no” after choosing the Demon because they don’t actually have the Fortune
			// Teller's (or Widow’s) ability, because they are poisoned."
			// The Widow was evil, so the Cannibal carries its own Poisoned reminder.
			const s = scenario(['cannibal', 'widow', 'imp', 'chef', 'monk']).execute('widow');
			expect(abilityState(s.game, s.seat('cannibal'), s.characters).works).toBe(false);
			const picker = infoPicker(s.game, s.seat('cannibal'), 'fortuneteller', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			const no = { seats: [s.seat('imp'), s.seat('chef')], yes: false };
			expect(isTruthful(picker, no)).toBe(false);
			expect(isAllowed(picker, no)).toBe(true);
		});
		it('Example 3: Eating Mutant brings no night information', () => {
			// Wiki: "It is the fourth night and the Mutant was executed today. The Cannibal doesn’t
			// learn anything tonight, because a real Mutant would not wake."
			const s = scenario(['cannibal', 'mutant', 'imp', 'chef', 'poisoner'])
				.execute('mutant')
				.newDay();
			expect(nightSheetPresence('mutant')).toEqual({ firstNight: false, otherNight: false });
			expect(infoPicker(s.game, s.seat('cannibal'), 'mutant', s.characters)).toBeUndefined();
			const steps = withGainedSteps([], s.game, s.characters, 'other');
			expect(steps).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Cannibal#How_to_Run)', () => {
		it('the Lunch reminder goes on a dead player other than the Cannibal', () => {
			// Wiki: "If a good player dies by execution, mark them with the LUNCH reminder, and remove the
			// Cannibal’s POISONED reminder if necessary."
			const s = scenario(['cannibal', 'empath', 'imp', 'chef', 'poisoner']).execute('empath');
			const lunch = { characterId: 'cannibal', label: 'Lunch' };
			expect(reminderTargetMisses(s.game, lunch, s.seat('empath'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, lunch, s.seat('chef'), s.characters)).toEqual(['life']);
		});

		it("holds the executed good player's ability, and wakes when that character would", () => {
			// Wiki: "The Cannibal now has this good player’s ability (do not say which), and will wake at
			// night when this good character would normally wake."
			const data = committedGameData();
			const s = scenario(['cannibal', 'empath', 'imp', 'chef', 'poisoner'])
				.execute('empath')
				.newDay();
			const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
			const steps = withGainedSteps(
				nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				s.game,
				s.characters,
				'other',
				data.nightSheet.otherNight
			);
			expect(steps.filter((step) => step.gained).map((step) => step.gained)).toEqual([
				expect.objectContaining({ seatId: s.seat('cannibal'), characterId: 'empath' })
			]);
		});

		it('the Poisoned reminder goes on the Cannibal only, and poisons them', () => {
			// Wiki: "If an evil player dies by execution, mark them with the LUNCH reminder and mark the
			// Cannibal with the POISONED reminder. The Cannibal is poisoned."
			const s = scenario(['cannibal', 'widow', 'imp', 'chef', 'monk']).execute('widow');
			const poisoned = { characterId: 'cannibal', label: 'Poisoned' };
			expect(reminderTargetMisses(s.game, poisoned, s.seat('cannibal'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, poisoned, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
			expect(abilityState(s.game, s.seat('cannibal'), s.characters).impairments).toMatchObject([
				{ reason: 'poisoned', source: { characterId: 'cannibal' } }
			]);
		});
		it('after an evil lunch, the step reminds the Storyteller the Cannibal is poisoned', () => {
			// Wiki: "If an evil player dies by execution, mark them with the LUNCH reminder and mark the
			// Cannibal with the POISONED reminder. The Cannibal is poisoned."
			const data = committedGameData();
			for (const evil of ['widow', 'baron']) {
				const s = scenario(['cannibal', evil, 'imp', 'chef', 'monk'])
					.execute(evil)
					.reminder('cannibal', 'cannibal', 'Poisoned')
					.newDay();
				const steps = withGainedSteps(
					[],
					s.game,
					s.characters,
					'other',
					data.nightSheet.otherNight
				);
				expect(steps.map((step) => [step.reminder, step.gained?.ifEvil])).toEqual([
					['The Cannibal is poisoned: the player whose ability they have is evil.', 'Poisoned']
				]);
				expect(nightStepAlerts(s.game, 'cannibal', s.characters).map((a) => a.kind)).not.toContain(
					'missing-token'
				);
			}
		});

		it('warns at their step when the Cannibal is missing Poisoned after an evil lunch', () => {
			// Wiki: "If an evil player dies by execution, mark them with the LUNCH reminder and mark the
			// Cannibal with the POISONED reminder. The Cannibal is poisoned."
			// The execution marks the Cannibal Poisoned by itself (M70); the warning is for when the
			// Storyteller takes it off.
			const ate = scenario(['cannibal', 'widow', 'imp', 'chef', 'monk']).execute('widow');
			const token = ate.game.seats[ate.seat('cannibal')].reminders.find(
				(r) => r.label === 'Poisoned'
			)!;
			const s = ate.do({ type: 'RemoveReminder', reminderId: token.reminderId }).newDay();
			expect(nightStepAlerts(s.game, 'cannibal', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'missing-token',
					seatId: s.seat('cannibal'),
					token: 'Poisoned'
				})
			);
			const good = scenario(['cannibal', 'empath', 'imp', 'chef', 'monk'])
				.execute('empath')
				.newDay();
			expect(
				nightStepAlerts(good.game, 'cannibal', good.characters).map((a) => a.kind)
			).not.toContain('missing-token');
		});
	});

	describe('Summary (https://wiki.bloodontheclocktower.com/Cannibal#Summary)', () => {
		const ate = (id: string) =>
			scenario(['cannibal', id, 'imp', 'chef', 'poisoner']).execute(id).newDay();
		const misregisters = (s: ReturnType<typeof ate>) =>
			registrations(s.game, s.characters).some((r) => r.seatId === s.seat('cannibal'));

		it("the Cannibal who ate the Recluse might register as evil, as the Recluse's ability does", () => {
			// Wiki: "If a good player dies by execution, the Cannibal gains that player’s ability."
			const s = ate('recluse');
			expect(misregisters(s)).toBe(true);
			expect(registrations(s.game, s.characters)).toContainEqual(
				expect.objectContaining({
					seatId: s.seat('cannibal'),
					alignments: ['good', 'evil'],
					source: { characterId: 'recluse', seatId: s.seat('cannibal') }
				})
			);
		});

		it('a dead Cannibal keeps the Recluse ability, but not their Cannibal ability', () => {
			// Wiki: "If the Cannibal has an “even if dead” ability, such as the Recluse, or an ability
			// that implies it works while dead, such as the Ravenkeeper or Sweetheart, the Cannibal
			// keeps that ability when they die, but loses their Cannibal ability."
			const s = ate('recluse').dies('cannibal');
			expect(hasAbilityOf(s.game, s.seat('cannibal'), 'recluse', s.characters)).toBe(true);
			expect(hasAbilityOf(s.game, s.seat('cannibal'), 'cannibal', s.characters)).toBe(false);
			expect(misregisters(s)).toBe(true);
		});

		it('a dead Cannibal loses an ability that does not work while dead', () => {
			// Wiki: "If the Cannibal has an “even if dead” ability, such as the Recluse, or an ability
			// that implies it works while dead, such as the Ravenkeeper or Sweetheart, the Cannibal
			// keeps that ability when they die, but loses their Cannibal ability."
			const s = ate('empath').dies('cannibal');
			expect(hasAbilityOf(s.game, s.seat('cannibal'), 'empath', s.characters)).toBe(false);
			expect(gainedAbilities(s.game, s.characters)).toEqual([]);
		});

		it('the Demon attacking the Cannibal who ate the Ravenkeeper sets off the Ravenkeeper ability', () => {
			// Wiki: "If the Cannibal has an “even if dead” ability, such as the Recluse, or an ability
			// that implies it works while dead, such as the Ravenkeeper or Sweetheart, the Cannibal
			// keeps that ability when they die, but loses their Cannibal ability."
			const s = ate('ravenkeeper').dusk();
			expect(nightStepAlerts(s.game, 'imp', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'on-death',
					seatId: s.seat('cannibal'),
					source: { characterId: 'ravenkeeper', seatId: s.seat('cannibal') }
				})
			);
		});

		it('the Cannibal killed at night with the Ravenkeeper ability still wakes for it', () => {
			// Wiki: "If the Cannibal has an “even if dead” ability, such as the Recluse, or an ability
			// that implies it works while dead, such as the Ravenkeeper or Sweetheart, the Cannibal
			// keeps that ability when they die, but loses their Cannibal ability."
			const data = committedGameData();
			const s = ate('ravenkeeper').dusk().dies('cannibal', 'imp');
			const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
			const steps = withGainedSteps(
				nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				s.game,
				s.characters,
				'other',
				data.nightSheet.otherNight
			);
			expect(steps.filter((step) => step.gained).map((step) => step.gained)).toEqual([
				expect.objectContaining({ seatId: s.seat('cannibal'), characterId: 'ravenkeeper' })
			]);
		});
	});

	describe('the execution marks the Lunch (M70)', () => {
		const cast = ['cannibal', 'empath', 'imp', 'chef', 'poisoner'];
		const tokens = (s: ReturnType<typeof scenario>, ref: string) =>
			s.game.seats[s.seat(ref)].reminders
				.filter((r) => r.characterId === 'cannibal')
				.map((r) => r.label);

		it('marks an executed good player Lunch, and the Cannibal stays healthy', () => {
			// Wiki: "If a good player dies by execution, mark them with the LUNCH reminder, and remove the
			// Cannibal’s POISONED reminder if necessary."
			const s = scenario(cast).execute('empath');
			expect(tokens(s, 'empath')).toEqual(['Lunch']);
			expect(tokens(s, 'cannibal')).toEqual([]);
		});

		it('marks an executed evil player Lunch and the Cannibal Poisoned', () => {
			// Wiki: "If an evil player dies by execution, mark them with the LUNCH reminder and mark the
			// Cannibal with the POISONED reminder."
			const s = scenario(cast).execute('poisoner');
			expect(tokens(s, 'poisoner')).toEqual(['Lunch']);
			expect(tokens(s, 'cannibal')).toEqual(['Poisoned']);
		});

		it('moves the Lunch to the next executed player and takes the Poisoned off for a good one', () => {
			// Wiki: "If a good player dies by execution, mark them with the LUNCH reminder, and remove the
			// Cannibal’s POISONED reminder if necessary."
			const s = scenario(cast).execute('poisoner').newDay().execute('empath');
			expect(tokens(s, 'poisoner')).toEqual([]);
			expect(tokens(s, 'empath')).toEqual(['Lunch']);
			expect(tokens(s, 'cannibal')).toEqual([]);
		});
	});
});
