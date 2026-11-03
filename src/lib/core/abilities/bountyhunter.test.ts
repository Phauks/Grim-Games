/**
 * Bounty Hunter: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bounty_Hunter
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bounty Hunter.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupAlignmentTasks } from '#lib/core/rules/setup-alignment.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { wakeConditionMet } from '#lib/core/rules/wakes-when.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Bounty Hunter', () => {
	const character = committedCharacter('bountyhunter');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Bounty Hunter');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('bountyhunter')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bounty_Hunter#Examples)', () => {
		it('Example 1: Bounty Hunter finds an evil Harpy, then another', () => {
			// Wiki: "Alex is the Bounty Hunter, Ben is the Harpy, and Abdallah is the Tea Lady. During
			// setup, the Storyteller decides that Abdallah will be the Evil Tea Lady. On the first
			// night, Alex learns Ben. On day 3, Ben is executed. That night, Alex learns Abdallah."
			// The Bounty Hunter is shown an evil player, such as the Harpy; never a good one.
			const s = scenario(['bountyhunter', 'harpy', 'imp', 'chef', 'monk']);
			const picker = infoPicker(s.game, s.seat('bountyhunter'), 'bountyhunter', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('harpy')] })).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('imp')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef')] })).toBe(false);
		});
		it('Example 2: Poisoned Bounty Hunter gets a good player instead', () => {
			// Wiki: "On the first night, the Bounty Hunter learns Julian, who is the evil Baron. When
			// Julian dies, the Poisoner targets the Bounty Hunter. That night, the Bounty Hunter
			// learns Evin, who is the good Magician."
			const first = scenario(['bountyhunter', 'baron', 'magician', 'poisoner', 'imp']);
			const before = infoPicker(
				first.game,
				first.seat('bountyhunter'),
				'bountyhunter',
				first.characters
			)!;
			expect(isTruthful(before, { seats: [first.seat('baron')] })).toBe(true);
			const s = first.execute('baron').newDay().poisoned('bountyhunter');
			const picker = infoPicker(s.game, s.seat('bountyhunter'), 'bountyhunter', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('magician')] })).toBe(false);
			expect(isAllowed(picker, { seats: [s.seat('magician')] })).toBe(true);
		});
		it('Example 3: Drunk Bounty Hunter learns two good players', () => {
			// Wiki: "Lachlan is the Drunk who thinks he is the Bounty Hunter. No evil Townsfolk was
			// added at setup, because the Bounty Hunter is not in play. On the first night, Lachlan
			// learns Marianna, who is the good Empath. When Marianna dies, Lachlan learns Doug, who is
			// the good Flowergirl."
			// A Drunk who thinks they are the Bounty Hunter may be shown a good player.
			const s = scenario(['bountyhunter', 'harpy', 'imp', 'chef', 'monk']).drunk('bountyhunter');
			const picker = infoPicker(s.game, s.seat('bountyhunter'), 'bountyhunter', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef')] })).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Bounty_Hunter#How_to_Run)', () => {
		const cast = ['bountyhunter', 'harpy', 'imp', 'chef', 'monk'];

		it('asks for one evil Townsfolk at setup', () => {
			// Wiki: "During setup, turn one Townsfolk character token upside down, to represent that they
			// are evil."
			const s = scenario(cast);
			expect(setupAlignmentTasks(s.game, s.characters)).toMatchObject([
				{ characterId: 'bountyhunter', type: 'townsfolk', alignment: 'evil', count: 1, done: false }
			]);
			const turned = s.do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('chef'),
				alignment: 'evil'
			}));
			expect(setupAlignmentTasks(turned.game, turned.characters)).toMatchObject([
				{ seats: [turned.seat('chef')], done: true }
			]);
		});

		it('prepares the Know reminder for an evil player only', () => {
			// Wiki: "Mark one evil player with the KNOW reminder."
			expect(setupPrep('bountyhunter', 'Bounty Hunter')[0]).toMatchObject({
				tokens: ['Know'],
				target: 'an evil player'
			});
			const s = scenario(cast);
			const know = { characterId: 'bountyhunter', label: 'Know' };
			expect(reminderTargetMisses(s.game, know, s.seat('harpy'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, know, s.seat('chef'), s.characters)).toEqual([
				'alignment'
			]);
		});

		it('wakes on a later night only when the player marked Know has died', () => {
			// Wiki: "Each time the player marked KNOW dies, mark a new evil player with the KNOW
			// reminder. That night, wake the Bounty Hunter, point to the player marked KNOW, then put the
			// Bounty Hunter to sleep."
			const s = scenario(cast).reminder('harpy', 'bountyhunter', 'Know').newDay();
			const wakes = (at: typeof s) =>
				wakeConditionMet(
					at.game,
					'bountyhunter',
					at.seat('bountyhunter'),
					at.characters,
					new Set()
				);
			expect(wakes(s)).toBe(false);
			expect(wakes(s.execute('harpy'))).toBe(true);
		});
	});
});
