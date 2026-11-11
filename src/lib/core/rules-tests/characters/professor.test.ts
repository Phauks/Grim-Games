/**
 * Professor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Professor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Professor.
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
	committedNightOrder,
	nightSheetPresence,
	committedCharacters
} from '#lib/core/testing/committed-data.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import { withNightInfo } from '#lib/core/rules/night/info/steps.ts';
import { revivedSinceNewDay } from '#lib/core/rules/night/night-numbers.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { promptApplies, reminderPrompt } from '#lib/core/rules/reminders/reminder-prompts.ts';
import { revivedAfterStep } from '#lib/core/rules/night/revived-tonight.ts';

describe('Professor', () => {
	const character = committedCharacter('professor');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Professor');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Alive', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('professor')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Professor#Examples)', () => {
		const revive = { characterId: 'professor', label: 'Alive' };
		const misses = (s: Scenario, on: string) =>
			reminderTargetMisses(s.game, revive, s.seat(on), s.characters);

		it('Example 1: Chosen dead player was secretly a Lunatic', () => {
			// Wiki: "The Professor chooses a dead player who is claiming to be the Tea Lady. The player is
			// actually the Lunatic. Nobody is resurrected."
			const s = scenario(['professor', 'lunatic', 'imp', 'chef', 'poisoner']).dies('lunatic');
			expect(misses(s, 'lunatic')).toEqual(['type']);
		});

		it("Example 2: Revived Grandmother learns a good player's character", () => {
			// Wiki: "The Professor resurrects the Grandmother, who learns a good player’s character. At
			// dawn, all players learn the Grandmother player is alive, but not that the player is the
			// Grandmother."
			const s = scenario(['professor', 'grandmother', 'imp', 'chef', 'poisoner']).dies(
				'grandmother',
				'imp'
			);
			expect(misses(s, 'grandmother')).toEqual([]);
			const revived = s.do((at) => ({
				type: 'SetDead',
				seatId: at.seat('grandmother'),
				dead: false
			}));
			expect(
				abilityState(revived.game, revived.seat('grandmother'), revived.characters).works
			).toBe(true);
		});

		it('Example 3: Drunk Professor picks a dead Fool', () => {
			// Wiki: "The drunk Professor chooses to resurrect the Minstrel. Unbeknownst to the Professor, the
			// Minstrel was regurgitated by the Shabaloth and is now alive. The Storyteller shakes their head
			// no, because the Professor must choose a dead player. The Professor chooses the dead Fool
			// instead. Nothing happens because the Professor is drunk, and the Professor cannot use their
			// ability again."
			const s = scenario(['professor', 'minstrel', 'shabaloth', 'fool', 'chef', 'poisoner'])
				.drunk('professor')
				.dies('minstrel', 'shabaloth')
				.do((at) => ({ type: 'SetDead', seatId: at.seat('minstrel'), dead: false }))
				.dies('fool');
			expect(misses(s, 'minstrel')).toEqual(['life']);
			expect(misses(s, 'fool')).toEqual([]);
			expect(abilityState(s.game, s.seat('professor'), s.characters).works).toBe(false);
			const spent = s.reminder('professor', 'professor', 'No Ability');
			// Waits on the engine (M15k): the Professor's step has no condition that stops it waking once its
			// No Ability token is placed (as the Seamstress's has).
			expect(
				wakeConditionMet(
					spent.game,
					'professor',
					spent.seat('professor'),
					spent.characters,
					new Set()
				)
			).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Professor#How_to_Run)', () => {
		const cast = ['professor', 'innkeeper', 'empath', 'chef', 'poisoner', 'imp'];

		it('may choose a dead player, or no one, each night but the first', () => {
			// Wiki: "Each night except the first, wake the Professor. The Professor either shakes their
			// head no or points to a dead player. Put the Professor to sleep."
			const s = scenario(cast).newDay();
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('might choose a dead player');
			expect(
				wakeConditionMet(s.game, 'professor', s.seat('professor'), s.characters, new Set())
			).toBe(true);
		});

		it('revives a dead Townsfolk marked Alive, who wakes only at their steps after the Professor', () => {
			// Wiki: "If the Professor chose a dead Townsfolk, the chosen player becomes alive again—mark
			// them with the Professor’s ALIVE reminder and remove their shroud. (They wake later
			// tonight if they normally would."
			expect(reminderPrompt('Alive', 'professor', committedCharacters())).toBe('revive');
			expect(promptApplies('revive', true)).toBe(true);
			const s = scenario(cast)
				.newDay()
				.dies('innkeeper', 'imp')
				.dies('empath', 'imp')
				.reminder('innkeeper', 'professor', 'Alive')
				.reminder('empath', 'professor', 'Alive')
				.do(
					(at) => ({ type: 'SetDead', seatId: at.seat('innkeeper'), dead: false }),
					(at) => ({ type: 'SetDead', seatId: at.seat('empath'), dead: false })
				);
			const order = committedNightOrder('otherNight');
			const revived = new Set([s.seat('innkeeper'), s.seat('empath')]);
			const skips = (seat: 'innkeeper' | 'empath') =>
				revivedAfterStep(s.game, s.seat(seat), seat, order, s.characters, revived);
			expect(skips('innkeeper')).toBe(true);
			expect(skips('empath')).toBe(false);
		});

		it('wakes a revived first-night-only Townsfolk straight away', () => {
			// Wiki: "If they wake on the first night only, they wake now to use their ability."
			const s = scenario(cast)
				.newDay()
				.dies('chef', 'imp')
				.reminder('chef', 'professor', 'Alive')
				.do((at) => ({ type: 'SetDead', seatId: at.seat('chef'), dead: false }));
			expect(s.game.seats[s.seat('chef')].dead).toBe(false);
			const data = committedGameData();
			const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
			const order = nightOrder({
				night: 'other',
				sheet: data.nightSheet,
				inPlay,
				players: 7,
				official: data.byId
			});
			const revived = [...revivedSinceNewDay(s.session.log.entries.flatMap((e) => e.events))];
			const ids = withNightInfo(order.steps, s.game, s.characters, 'other', {
				died: [],
				revived
			}).map((step) => step.id);
			expect(ids).toContain('chef');
			expect(ids.indexOf('chef')).toBe(ids.indexOf('professor') + 1);
		});

		it('marks the Professor No Ability once they have chosen', () => {
			// Wiki: "The Professor loses their ability—mark them with the NO ABILITY reminder and
			// remove their night token from the night sheet."
			const s = scenario(cast).newDay();
			const spent = { characterId: 'professor', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, spent, s.seat('professor'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).not.toEqual([]);
		});
	});
});
