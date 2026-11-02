/**
 * Pukka: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pukka
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pukka.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	castGame,
	type CastGame,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { survivesFirstDeath } from '#lib/core/rules/first-death.ts';
import { reliability } from '#lib/core/rules/night-info.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Pukka', () => {
	const character = committedCharacter('pukka');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Pukka');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned', 'Poisoned', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('pukka')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pukka#Examples)', () => {
		const poisonedByThePukka = (s: Scenario, ref: string) =>
			abilityState(s.game, s.seat(ref), s.characters).impairments.some(
				(i) => i.reason === 'poisoned' && i.source.characterId === 'pukka'
			);

		it('Example 1: Poisoned Chambermaid misinformed, then dies next night', () => {
			// Wiki: "The Pukka poisons the Chambermaid. The Chambermaid gets false information. The next
			// night, the Chambermaid dies."
			const s = scenario(['pukka', 'chambermaid', 'chef', 'empath', 'poisoner']).reminder(
				'chambermaid',
				'pukka',
				'Poisoned'
			);
			const info = reliability(s.game, s.seat('chambermaid'), 'chambermaid', s.characters);
			expect(info.unreliable).toBe('poisoned');
			expect(info.impairments[0].source.characterId).toBe('pukka');
			// The next night nothing protects the poisoned Chambermaid from the Pukka's kill.
			const next = s.newDay();
			expect(
				nightStepAlerts(next.game, 'pukka', next.characters).filter((a) => a.kind === 'protected')
			).toEqual([]);
		});

		it("Example 2: Drunk Pukka's miss delays Gossip's death", () => {
			// Wiki: "The Pukka poisons the Fool. The next day, the Fool is executed and dies because they
			// have no ability. The next night, nobody dies and the Pukka poisons the Gossip. The next night,
			// the Pukka is drunk and tries to poison the Tinker, but does not. The next night, the Gossip
			// dies because the Pukka is sober."
			const cast = ['pukka', 'fool', 'gossip', 'tinker', 'goon', 'chef', 'poisoner'];
			const fool = scenario(cast).reminder('fool', 'pukka', 'Poisoned');
			expect(poisonedByThePukka(fool, 'fool')).toBe(true);
			expect(
				survivesFirstDeath(fool.game, fool.seat('fool'), 'execution', fool.characters)
			).toBeUndefined();
			expect(fool.newDay().execute('fool').game.seats[fool.seat('fool')].dead).toBe(true);

			const drunkNight = scenario(cast)
				.reminder('gossip', 'pukka', 'Poisoned')
				.reminder('tinker', 'pukka', 'Poisoned')
				.reminder('pukka', 'goon', 'Drunk');
			expect(poisonedByThePukka(drunkNight, 'tinker')).toBe(false);

			const soberNight = scenario(cast).reminder('gossip', 'pukka', 'Poisoned');
			expect(poisonedByThePukka(soberNight, 'gossip')).toBe(true);
		});

		it('Example 3: Exorcist blocks Pukka while poisoned Pacifist dies', () => {
			// Wiki: "The Pukka poisons the Pacifist. The next night, the Exorcist chooses the Pukka to not
			// wake tonight. The Pacifist dies, but the Pukka does not wake to attack tonight."
			const s = scenario(['pukka', 'pacifist', 'exorcist', 'chef', 'poisoner'])
				.reminder('pacifist', 'pukka', 'Poisoned')
				.newDay()
				.reminder('pukka', 'exorcist', 'Chosen');
			expect(nightStepAlerts(s.game, 'pukka', s.characters)).toContainEqual(
				expect.objectContaining({ kind: 'blocked', seatId: s.seat('pukka'), works: true })
			);
			// The block stops the Pukka waking, not last night's poison from killing.
			expect(poisonedByThePukka(s, 'pacifist')).toBe(true);
		});

		it("Example 4: Poisoned Moonchild's curse target is spared", () => {
			// Wiki: "The Moonchild is executed, dies, and chooses the Courtier. That night, the Pukka
			// chooses the Moonchild. The Courtier does not die because the Moonchild is poisoned."
			const s = scenario(['moonchild', 'courtier', 'pukka', 'chef', 'poisoner'])
				.execute('moonchild')
				.reminder('courtier', 'moonchild', 'Dead')
				.reminder('moonchild', 'pukka', 'Poisoned');
			expect(poisonedByThePukka(s, 'moonchild')).toBe(true);
			expect(validDeathCauses(s.game, s.seat('courtier'), s.characters)).toContainEqual(
				expect.objectContaining({
					cause: 'moonchild',
					flags: [expect.objectContaining({ code: 'impaired' })]
				})
			);
		});
	});

	/**
	 * Trevor's Pukka night flowchart (2026-10-24, sent in the Night walk-through thread), one
	 * test per branch, read against https://wiki.bloodontheclocktower.com/Pukka. The app
	 * doesn't run the Pukka's turn itself: the Storyteller moves the tokens, and the app reads
	 * them (who is poisoned, what the Pukka's step warns about).
	 */
	describe('night flowchart', () => {
		// Seat 0 Pukka, 1 Exorcist, 2 Goon, 3 Ravenkeeper, 4 Monk, 5 Poisoner.
		const cast = ['pukka', 'exorcist', 'goon', 'ravenkeeper', 'monk', 'poisoner'];
		const PUKKA = 0;
		const MARKED = 3;
		const add =
			(i: number, characterId: string, label: string) =>
			(s: string[]): Command => ({
				type: 'AddReminder',
				seatId: s[i],
				reminder: { characterId, label }
			});
		const dead =
			(i: number) =>
			(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });
		const marked = add(MARKED, 'pukka', 'Poisoned');
		const alerts = (g: CastGame) => nightStepAlerts(g.game, 'pukka', characters);
		const poisonedByPukka = (g: CastGame, seat = MARKED) =>
			abilityState(g.game, g.seats[seat], characters).impairments.some(
				(i) => i.reason === 'poisoned' && i.source.characterId === 'pukka'
			);

		it('chosen by the Exorcist: the Pukka’s step says it does not wake to choose', () => {
			// https://wiki.bloodontheclocktower.com/Exorcist : a chosen Demon doesn't wake tonight.
			const g = castGame(cast, add(PUKKA, 'exorcist', 'Chosen'));
			expect(alerts(g)).toContainEqual(
				expect.objectContaining({
					kind: 'blocked',
					seatId: g.seats[PUKKA],
					source: expect.objectContaining({ characterId: 'exorcist', seatId: g.seats[1] }),
					works: true
				})
			);
		});

		it('chosen by a poisoned Exorcist: the block shows as not working', () => {
			const g = castGame(cast, add(PUKKA, 'exorcist', 'Chosen'), add(1, 'poisoner', 'Poisoned'));
			expect(alerts(g)).toContainEqual(expect.objectContaining({ kind: 'blocked', works: false }));
		});

		it('the Exorcist on someone else: no block', () => {
			const g = castGame(cast, add(MARKED, 'exorcist', 'Chosen'));
			expect(alerts(g).some((a) => a.kind === 'blocked')).toBe(false);
		});

		it('a drunk or poisoned Pukka is flagged at its step, so its choice poisons nobody', () => {
			const poisoned = castGame(cast, add(PUKKA, 'poisoner', 'Poisoned'));
			expect(alerts(poisoned)).toContainEqual(
				expect.objectContaining({ kind: 'impaired', seatId: poisoned.seats[PUKKA] })
			);
			// The first player tonight to choose the Goon is drunk: https://wiki.bloodontheclocktower.com/Goon
			const goon = castGame(cast, add(PUKKA, 'goon', 'Drunk'));
			expect(alerts(goon)).toContainEqual(
				expect.objectContaining({
					kind: 'impaired',
					seatId: goon.seats[PUKKA],
					impairments: [expect.objectContaining({ reason: 'drunk' })]
				})
			);
		});

		it('a sober, healthy Pukka’s choice is poisoned', () => {
			expect(poisonedByPukka(castGame(cast, marked))).toBe(true);
		});

		it('while the Pukka is drunk or poisoned, its marked player is not affected', () => {
			expect(poisonedByPukka(castGame(cast, marked, add(PUKKA, 'poisoner', 'Poisoned')))).toBe(
				false
			);
			expect(poisonedByPukka(castGame(cast, marked, add(PUKKA, 'goon', 'Drunk')))).toBe(false);
		});

		it('the attack: the marked player’s protection and death triggers are flagged', () => {
			const g = castGame(cast, marked, add(MARKED, 'monk', 'Safe'));
			expect(alerts(g)).toContainEqual(
				expect.objectContaining({ kind: 'protected', seatId: g.seats[MARKED] })
			);
			// A trigger at the moment of death is still poisoned: the Ravenkeeper wakes for nothing.
			expect(alerts(g)).toContainEqual(
				expect.objectContaining({ kind: 'on-death', seatId: g.seats[MARKED], works: false })
			);
		});

		it('the poison comes off the marked player whether or not they died', () => {
			// Other nights: tonight's choice is poisoned; last night's gets Dead and loses Poisoned.
			expect(placeholdersFor(character, 'other')).toEqual([
				{ tokens: [{ label: 'Poisoned', action: 'place' }] },
				{
					tokens: [
						{ label: 'Dead', action: 'place' },
						{ label: 'Poisoned', action: 'remove' }
					]
				}
			]);
		});

		it('once the Pukka dies or changes character, its markers poison nobody', () => {
			expect(poisonedByPukka(castGame(cast, marked, dead(PUKKA)))).toBe(false);
			const changed = castGame(cast, marked, (s) => ({
				type: 'AssignCharacter',
				seatId: s[PUKKA],
				characterId: 'imp'
			}));
			expect(poisonedByPukka(changed)).toBe(false);
		});
	});
});
