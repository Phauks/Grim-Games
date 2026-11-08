/**
 * Chef: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Chef
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Chef.
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
import { infoPicker, isAllowed, isTruthful, validInformation } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Chef', () => {
	const character = committedCharacter('chef');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Chef');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('chef')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Chef#Examples)', () => {
		it('Example 1: no evil neighbours, learns zero', () => {
			// Wiki: "No evil players are sitting next to each other. The Chef learns a '0'."
			const s = scenario(['chef', 'imp', 'empath', 'poisoner', 'monk']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(0);
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
		});

		it('Example 2: two separate evil pairs, learns two', () => {
			// Wiki: "The Imp is sitting next to the Baron. Across the circle, the Poisoner is sitting next
			// to the Scarlet Woman. The Chef learns a '2'."
			const s = scenario(['chef', 'imp', 'baron', 'monk', 'poisoner', 'scarletwoman', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(2);
		});

		it('Example 3: evil Traveller between Imp and Minion, plus a Minion pair, learns three', () => {
			// Wiki: "An evil Scapegoat is sitting between the Imp and a Minion. Across the circle, two
			// other Minions are sitting next to each other. The Chef learns a '3'."
			// An evil Traveller counts as evil: Imp, Scapegoat and Poisoner make two pairs.
			const s = scenario([
				'chef',
				'imp',
				'scapegoat',
				'poisoner',
				'monk',
				'scarletwoman',
				'baron',
				'empath'
			]).do((at) => ({ type: 'SetAlignment', seatId: at.seat('scapegoat'), alignment: 'evil' }));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(3);
		});

		it('Example 4: Recluse between Imp and Poisoner, learns one', () => {
			// Wiki: "The Recluse is sitting between the Imp and the Poisoner. The Chef learns a '1'. Here,
			// the Recluse is registering as evil for the Imp-Recluse pair, but as good for the
			// Poisoner-Recluse pair."
			// The Recluse may register as evil for one pair and good for the other in the same
			// count.
			const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Chef#How_to_Run)', () => {
		it('on the first night, the Chef is shown a number and no players', () => {
			// Wiki: "During the first night, wake the Chef. Show the Chef fingers (0, 1, 2, etc.)
			// equaling the number of pairs of neighboring evil players."
			const s = scenario(['chef', 'imp', 'poisoner', 'monk', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters, 'first')!;
			expect(picker.kind).toBe('number');
			expect(picker.seatCount).toBe(0);
			expect(picker.range?.truth).toBe(1);
		});

		it('counts an evil pair that sits across the ends of the seating order', () => {
			// Wiki: "Show the Chef fingers (0, 1, 2, etc.) equaling the number of pairs of neighboring
			// evil players."
			const s = scenario(['poisoner', 'chef', 'empath', 'monk', 'imp']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters, 'first')!;
			expect(picker.range?.truth).toBe(1);
		});

		it('counts pairs, not players, so three evil players in a row make two', () => {
			// Wiki: "Show the Chef fingers (0, 1, 2, etc.) equaling the number of pairs of neighboring
			// evil players."
			const s = scenario(['chef', 'imp', 'poisoner', 'baron', 'monk', 'empath', 'soldier']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters, 'first')!;
			expect(picker.range?.truth).toBe(2);
		});
	});

	describe('the most pairs there can be (https://wiki.bloodontheclocktower.com/Chef)', () => {
		const fifteen = [
			'chef',
			'imp',
			'poisoner',
			'empath',
			'baron',
			'monk',
			'scarletwoman',
			'soldier',
			'mayor',
			'virgin',
			'slayer',
			'ravenkeeper',
			'undertaker',
			'washerwoman',
			'librarian'
		];
		const numbers = (s: ReturnType<typeof scenario>) =>
			validInformation(s.game, infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!).map(
				(v) => v.number
			);

		it('a poisoned Chef with four evil players is offered no more than three pairs', () => {
			// Wiki: "You start knowing how many pairs of evil players there are."
			// Four evil players make at most three pairs, all four in a row, so in a game of
			// fifteen no higher number is offered.
			const s = scenario(fifteen).do((at) => ({
				type: 'AddReminder',
				seatId: at.seat('chef'),
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}));
			expect(numbers(s)).toEqual([1, 0, 2, 3]);
		});

		it('a Recluse who may register as evil can make one more pair', () => {
			// Wiki: "The Recluse is sitting between the Imp and the Poisoner. The Chef learns a '1'. Here,
			// the Recluse is registering as evil for the Imp-Recluse pair, but as good for the
			// Poisoner-Recluse pair."
			// With a Recluse, five players may register as evil, who make at most four pairs.
			const s = scenario(fifteen.map((id) => (id === 'soldier' ? 'recluse' : id))).do((at) => ({
				type: 'AddReminder',
				seatId: at.seat('chef'),
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}));
			expect(Math.max(...numbers(s).map((n) => n ?? 0))).toBe(4);
		});

		it('every pair when everyone is evil', () => {
			// Wiki: "You start knowing how many pairs of evil players there are."
			const s = scenario(['chef', 'imp', 'poisoner', 'baron']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('chef'),
				alignment: 'evil'
			}));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(4);
			expect(picker.mostTrue).toBe(4);
		});
	});
});
