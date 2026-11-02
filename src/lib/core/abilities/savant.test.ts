/**
 * Savant: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Savant
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Savant.
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
import type { Script } from '#lib/core/data/index.ts';
import { partnerTruth, savantSituation, savantStatements } from '#lib/core/rules/savant.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

/** A script with the characters these examples seat. */
const script: Script = {
	meta: { name: 'Savant examples' },
	entries: ['savant', 'snakecharmer', 'chef', 'empath', 'mutant', 'poisoner', 'witch', 'imp'].map(
		(id) => ({ kind: 'official', id })
	)
};

describe('Savant', () => {
	const character = committedCharacter('savant');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Savant');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('savant')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Savant#Examples)', () => {
		it.fails('Example 1: Savant: players in glasses good; Minion on couch', () => {
			// Wiki: "The Savant learns that "All players wearing glasses are good" and that "One player
			// sitting on the black couch is a Minion.""
			// One true and one false, about the players in the room, which the grimoire can't know.
			const s = scenario(['savant', 'chef', 'empath', 'mutant', 'poisoner', 'imp'], { script });
			expect(savantSituation(s.game, s.seat('savant'), s.characters).mode).toBe('one-each');
			engineGap(
				'unplanned',
				'a Savant statement about the players in the room (what they wear, where they sit) that the Storyteller marks true or false'
			);
		});

		it('Example 2: Savant: Snake Charmer exists; last night accurate', () => {
			// Wiki: "The Savant learns that "A Snake Charmer is in play" and "Everybody got true information
			// last night.""
			// The Snake Charmer is in play, so the other statement is the false one: the Chef was poisoned.
			const s = scenario(['savant', 'snakecharmer', 'chef', 'empath', 'poisoner', 'imp'], {
				script
			})
				.poisoned('chef')
				.do((at) => ({
					type: 'RecordNightInfo',
					seatId: at.seat('chef'),
					characterId: 'chef',
					text: 'Shown 0',
					abnormal: [{ reason: 'poisoned', characterId: 'poisoner', seatId: at.seat('poisoner') }]
				}))
				.newDay();
			const all = savantStatements(s.game, s.seat('savant'), s.characters);
			const charmer = all.find((x) => x.key === 'in-play:snakecharmer')!;
			const trueInfo = all.find((x) => x.key === 'townsfolk-true-info:')!;
			expect(charmer.truth).toBe('true');
			expect(trueInfo.truth).toBe('false');
			expect(partnerTruth(charmer, 'one-each')).toBe(false);
		});

		it.fails('Example 3: Savant: Demon is female; a player is evil', () => {
			// Wiki: "The Savant learns that "The Demon is a woman" and "Benjamin is evil.""
			// Ben is the Poisoner, so the statement about the Demon's player is the false one.
			const s = scenario(['savant', 'poisoner', 'chef', 'empath', 'mutant', 'imp'], { script });
			const all = savantStatements(s.game, s.seat('savant'), s.characters);
			expect(all.find((x) => x.key === `alignment:${s.seat('poisoner')}|evil`)?.truth).toBe('true');
			engineGap(
				'unplanned',
				"a Savant statement about the Demon's player as a person, which the Storyteller marks true or false"
			);
		});

		it('Example 4: Savant: two players align; one Outsider', () => {
			// Wiki: "The Savant learns that "Evin and Amy are the same alignment" and "There is one Outsider
			// in play.""
			// Evin (the Chef) and Amy (the Empath) are both good; the Mutant is the only Outsider.
			const s = scenario(['savant', 'chef', 'empath', 'mutant', 'poisoner', 'imp'], { script });
			const all = savantStatements(s.game, s.seat('savant'), s.characters);
			const same = `same-alignment:${s.seat('chef')}|${s.seat('empath')}|same`;
			expect(all.find((x) => x.key === same)?.truth).toBe('true');
			expect(all.find((x) => x.key === 'outsiders:1')?.truth).toBe('true');
			// Both are true, so the Savant may hear only one of them on a normal day.
			expect(savantSituation(s.game, s.seat('savant'), s.characters).mode).toBe('one-each');
			expect(
				partnerTruth(
					all.find((x) => x.key === same)!,
					'one-each'
				)
			).toBe(false);
		});
	});
});
