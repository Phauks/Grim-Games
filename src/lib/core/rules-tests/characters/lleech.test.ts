/**
 * Lleech: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lleech
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lleech.
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
import { abilityState, protection } from '#lib/core/rules/ability.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { nightTextPlain, nightTextSegments, placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';

describe('Lleech', () => {
	const character = committedCharacter('lleech');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Lleech');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lleech')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lleech#Examples)', () => {
		it("Example 1: Poisoned Noble's death kills Lleech; good wins", () => {
			// Wiki: "The Lleech poisons the Noble. The Noble learns false information. The Lleech is
			// executed, but does not die. The next day, the Noble is executed. The Noble and the Lleech
			// die. Good wins."
			const s = scenario(['noble', 'chef', 'empath', 'monk', 'poisoner', 'lleech']).reminder(
				'noble',
				'lleech',
				'Poisoned'
			);
			expect(abilityState(s.game, s.seat('noble'), s.characters).works).toBe(false);
			const lleechExecuted = s.newDay().execute('lleech');
			expect(gameEnds(lleechExecuted.game, lleechExecuted.characters)).toEqual([]);
			const nobleExecuted = lleechExecuted.newDay().execute('noble');
			const ends = gameEnds(nobleExecuted.game, nobleExecuted.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 2: Courtier-drunk Lleech outlasts poisoned Farmer, then dies', () => {
			// Wiki: "The Lleech poisons the Farmer. The Lleech is made drunk by the Courtier. The poisoned
			// Farmer dies, and the game continues because the Lleech is also drunk. The drunk Lleech is
			// executed and dies, and good wins."
			const s = scenario(['farmer', 'courtier', 'chef', 'empath', 'poisoner', 'lleech'])
				.reminder('farmer', 'lleech', 'Poisoned')
				.reminder('lleech', 'courtier', 'Drunk 3')
				.dies('farmer', 'lleech');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			const executed = s.newDay().execute('lleech');
			const ends = gameEnds(executed.game, executed.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Lleech#How_to_Run)', () => {
		const cast = ['noble', 'chef', 'empath', 'monk', 'poisoner', 'lleech'];
		const textFor = (night: 'first' | 'other') => {
			const placeholders = placeholdersFor(character, night);
			const reminder =
				night === 'first' ? character.firstNightReminder! : character.otherNightReminder!;
			return nightTextPlain(
				nightTextSegments(reminder, character, { ...(placeholders ? { placeholders } : {}) })
			);
		};

		it('marks the chosen player Poisoned on the first night', () => {
			// Wiki: "During the first night, wake the Lleech. They point at any player. That player is
			// poisoned—mark them with the POISONED reminder. Put the Lleech to sleep."
			expect(textFor('first')).toContain('[+Poisoned]');
			expect(textFor('first')).not.toContain('[+Dead]');
			const s = scenario(cast);
			const poisoned = { characterId: 'lleech', label: 'Poisoned' };
			expect(reminderTargetMisses(s.game, poisoned, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, poisoned, s.seat('poisoner'), s.characters)).toEqual([]);
		});

		it('kills the chosen player on each night after the first', () => {
			// Wiki: "Each night except the first, wake the Lleech. They point at any player. That
			// player dies—mark them with the DEAD reminder. Put the Lleech to sleep."
			expect(textFor('other')).toContain('[+Dead]');
			const s = scenario(cast).newDay().dusk();
			expect(nightKill(s.game, s.seat('lleech'), 'lleech', s.characters)).toEqual({
				max: 1,
				delayed: []
			});
		});

		it('keeps the Lleech from dying while the Poisoned player lives', () => {
			// Wiki: "If the Lleech would die but the player marked with the Lleech’s POISONED reminder is
			// alive, the Lleech does not die."
			const s = scenario(cast).reminder('chef', 'lleech', 'Poisoned');
			for (const by of ['execution', 'other'] as const) {
				expect(protection(s.game, s.seat('lleech'), s.characters, by)).toMatchObject({
					characterId: 'lleech'
				});
			}
			const hostDead = s.dies('chef', 'execution');
			expect(
				protection(hostDead.game, hostDead.seat('lleech'), hostDead.characters, 'execution')
			).toBeUndefined();
		});

		it('gives good the win when the Lleech kills the Poisoned player at night', () => {
			// Wiki: "If the player marked with the Lleech’s POISONED reminder is dead, the Lleech dies
			// and the good team wins."
			const s = scenario(cast).reminder('chef', 'lleech', 'Poisoned').dies('chef', 'lleech');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
	});
});
