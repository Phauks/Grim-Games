/**
 * Spy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Spy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Spy.
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
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { infoPicker, isAllowed, isTruthful, nightAnswer } from '#lib/core/rules/night-info.ts';
import { characterNominationPrompts } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Spy', () => {
	const character = committedCharacter('spy');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Spy');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('spy')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'signal', name: 'grimoire', time: 'night' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Spy#Examples)', () => {
		it('Example 1: Spy registers as Ravenkeeper to Washerwoman', () => {
			// Wiki: "The Washerwoman learns that either Abdallah or Douglas is the Ravenkeeper. Abdallah
			// is the Monk, and Douglas is the Spy registering as the Ravenkeeper."
			// Shown the Monk and the Spy as the Ravenkeeper: allowed only through the Spy's registration.
			const s = scenario(['washerwoman', 'monk', 'spy', 'imp', 'chef']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('monk'), s.seat('spy')], characterId: 'ravenkeeper' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
		it('Example 2: Spy registers evil to the Chef, good to the Empath', () => {
			// Wiki: "The Spy neighbours the Imp and the Empath. The Chef learns a "1" because the Spy is
			// registering as evil. Later that night, the Empath learns a "0" because the Spy is now
			// registering as good."
			// Between the Imp and the Empath, the Spy registers as evil for the Chef (1) and, later the
			// same night, as good for the Empath (0): each ability's registration is its own.
			const s = scenario(['chef', 'imp', 'spy', 'empath', 'monk']);
			const chef = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(isTruthful(chef, { seats: [], number: 1 })).toBe(true);
			const empath = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isAllowed(empath, { seats: [], number: 0 })).toBe(true);
			expect(isTruthful(empath, { seats: [], number: 0 })).toBe(false);
		});
		it('Example 3: Spy executed, Undertaker thinks Drunk died', () => {
			// Wiki: "The Spy nominates the Virgin and is executed by the Virgin’s ability, because the
			// Storyteller chooses that the Spy registers as a Townsfolk. That night, the Undertaker learns
			// that the Drunk died today, because the Spy is now registering as the Drunk."
			// The Spy may register as a Townsfolk when nominating the Virgin, and so be executed; that
			// night the Spy may register as an Outsider, such as the Drunk, for the Undertaker.
			const s = scenario(['spy', 'virgin', 'undertaker', 'imp', 'chef']).nominate('spy', 'virgin');
			expect(
				characterNominationPrompts(
					s.game,
					{ nominator: s.seat('spy'), nominee: s.seat('virgin') },
					s.characters
				)
			).toMatchObject([{ kind: 'execute-nominator', characterId: 'virgin' }]);
			expect(validDeathCauses(s.game, s.seat('spy'), s.characters).map((c) => c.cause)).toContain(
				'virgin'
			);
			const after = s.do((at) => ({ type: 'Execute', seatId: at.seat('spy'), cause: 'virgin' }));
			const answer = nightAnswer(
				after.game,
				after.seat('undertaker'),
				'undertaker',
				after.characters
			)!;
			expect(answer).toMatchObject({
				kind: 'character',
				value: 'spy',
				misregister: [after.seat('spy')]
			});
			expect(answer.registrations[0]?.types).toContain('outsider');
		});
	});
});
