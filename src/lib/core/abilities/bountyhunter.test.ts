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
});
