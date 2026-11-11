/**
 * Spirit of Ivory: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Spirit_of_Ivory
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Spirit of Ivory.
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
import { decide, dispatch } from '#lib/core/engine/index.ts';
import { extraEvilPlayers } from '#lib/core/rules/setup/extra-evil.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Spirit of Ivory', () => {
	const character = committedCharacter('spiritofivory');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Spirit of Ivory');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No More Evil']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('spiritofivory')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory#Examples)', () => {
		it('Example 1: Second evil conversion blocked; Goon stays good', () => {
			// Wiki: "The Fang Gu attacks an Outsider and creates an evil player. The Devil's
			// Advocate chooses the Goon at night. Normally, the Goon would turn evil, but the Goon
			// remains good because there is already 1 more evil character than normal in play."
			// Waits on the engine (M15o): the extra evil count only counts evil Townsfolk and Outsiders, so
			// the Outsider the Fang Gu turned into an evil Demon is not counted, and turning the
			// Goon evil gives no warning.
			const cast = ['fanggu', 'butler', 'devilsadvocate', 'goon', 'chef', 'empath', 'monk'];
			const s = scenario(cast)
				.rule('spiritofivory')
				.dies('fanggu', 'fanggu')
				.becomes('butler', 'fanggu', 'evil');
			const result = dispatch(
				s.session,
				{ type: 'SetAlignment', seatId: s.seat('goon'), alignment: 'evil' },
				s.ctx
			);
			expect(result.ok && result.warnings.map((w) => w.code)).toEqual(['extra-evil-limit']);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory#How_to_Run)', () => {
		const cast = ['chef', 'saint', 'empath', 'monk', 'poisoner', 'imp'];
		const turnEvil = (s: ReturnType<typeof scenario>, seat: string) =>
			decide(s.game, { type: 'SetAlignment', seatId: s.seat(seat), alignment: 'evil' }, s.ctx);

		it('puts No More Evil beside the Spirit of Ivory, not on a seat', () => {
			// Wiki: "At all times, if there is an extra evil character in play, mark the Spirit of
			// Ivory with the NO MORE EVIL reminder."
			const s = scenario(cast).rule('spiritofivory');
			const token = { characterId: 'spiritofivory', label: 'No More Evil' };
			expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toEqual(['global']);
		});

		it('counts an evil Townsfolk as the extra evil character', () => {
			// Wiki: "At all times, if there is an extra evil character in play, mark the Spirit of
			// Ivory with the NO MORE EVIL reminder."
			const s = scenario(cast).rule('spiritofivory');
			expect(extraEvilPlayers(s.game, s.characters)).toBe(0);
			const evil = s.do({ type: 'SetAlignment', seatId: s.seat('chef'), alignment: 'evil' });
			expect(extraEvilPlayers(evil.game, evil.characters)).toBe(1);
		});

		it('warns when a second player would become evil', () => {
			// Wiki: "If a player would become evil and the Spirit of Ivory is marked NO MORE EVIL,
			// that player stays good."
			const s = scenario(cast)
				.rule('spiritofivory')
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('chef'), alignment: 'evil' }));
			const result = turnEvil(s, 'saint');
			expect(result.ok && result.warnings.map((w) => w.code)).toEqual(['extra-evil-limit']);
		});

		it('lets another player become evil once the extra evil player turns good', () => {
			// Wiki: "(If any character becomes good, remove the reminder.)"
			const s = scenario(cast)
				.rule('spiritofivory')
				.do(
					(at) => ({ type: 'SetAlignment', seatId: at.seat('chef'), alignment: 'evil' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('chef'), alignment: 'good' })
				);
			expect(extraEvilPlayers(s.game, s.characters)).toBe(0);
			const result = turnEvil(s, 'saint');
			expect(result.ok && result.warnings).toEqual([]);
		});
	});
});
