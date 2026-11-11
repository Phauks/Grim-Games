/**
 * Harlot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Harlot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Harlot.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import {
	filledInfoToken,
	stepInfoCards,
	withChosen
} from '#lib/core/rules/night/info-token-characters.ts';
import { placeholdersFor } from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, isAllowed } from '#lib/core/rules/night/info/picker.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Harlot', () => {
	const character = committedCharacter('harlot');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Harlot');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('harlot')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Harlot#Examples)', () => {
		it('Example 1: Good Harlot dies with the Mutant they learned', () => {
			// Wiki: "The good Harlot wakes and chooses the Philosopher, who chooses to reveal. The next
			// night, the Harlot chooses the No Dashii, who chooses not to reveal. The next night, the
			// Harlot chooses the Mutant, who chooses to reveal. The Storyteller decides that the Harlot
			// and Mutant die tonight."
			const s = scenario(['harlot', 'philosopher', 'mutant', 'chef', 'witch', 'nodashii']).do(
				(at) => ({ type: 'SetAlignment', seatId: at.seat('harlot'), alignment: 'good' })
			);
			// Each chosen player is woken and shown the Harlot selected them.
			expect(filledInfoToken(s.characters.get('harlot')!, 'selected-you', 2)).toMatchObject({
				characterIds: ['harlot']
			});
			const causes = (at: typeof s, seat: 'harlot' | 'mutant') =>
				validDeathCauses(at.game, at.seat(seat), at.characters).map((c) => c.cause);
			expect(causes(s, 'harlot')).toContain('harlot');
			expect(causes(s, 'mutant')).toContain('harlot');
			const after = s
				.newDay()
				.newDay()
				.reminder('harlot', 'harlot', 'Dead')
				.reminder('mutant', 'harlot', 'Dead')
				.dies('harlot', 'harlot')
				.dies('mutant', 'harlot');
			for (const seat of ['harlot', 'mutant'] as const) {
				expect(after.game.seats[after.seat(seat)]).toMatchObject({
					dead: true,
					deathCause: 'harlot'
				});
			}
		});

		it('Example 2: Evil Harlot falsely claims revealed Sage is Witch', () => {
			// Wiki: "The evil Harlot chooses the Sage, who reveals. The next day, the Harlot says the Sage is
			// actually the Witch."
			const s = scenario(['harlot', 'sage', 'chef', 'witch', 'nodashii']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('harlot'),
				alignment: 'evil'
			}));
			expect(s.game.seats[s.seat('harlot')].alignment).toBe('evil');
			// The Sage agreed: the Harlot's step offers the Sage's true character to show. What the
			// Harlot claims by day is up to them.
			const picker = infoPicker(s.game, s.seat('harlot'), 'harlot', s.characters)!;
			const sage = [s.seat('sage')];
			expect(isAllowed(picker, { seats: sage, characterId: 'sage' })).toBe(true);
			expect(isAllowed(picker, { seats: sage, characterId: 'witch' })).toBe(false);
		});
	});

	describe('learning the chosen player’s character (its `character-of` learns rule)', () => {
		it('offers living players only, never the Harlot', () => {
			const s = scenario(['harlot', 'sage', 'chef', 'witch', 'nodashii'])
				.newDay()
				.dies('chef', 'nodashii');
			const picker = infoPicker(s.game, s.seat('harlot'), 'harlot', s.characters)!;
			const seats = picker.options.map((o) => o.seats[0]);
			expect(seats).toEqual([s.seat('sage'), s.seat('witch'), s.seat('nodashii')]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Harlot#How_to_Run)', () => {
		const cards = () =>
			stepInfoCards(character, character.otherNightReminder).map((c) => c.token.id);

		it('the chosen player is shown the Harlot selected them, and asked to reveal', () => {
			// Wiki: "Wake the chosen player, show them the THIS CHARACTER SELECTED YOU' info token, then
			// the Harlot token. That player either nods their head yes or shakes their head no."
			expect(cards()).toEqual(expect.arrayContaining(['selected-you', 'sleep-with-harlot']));
			expect(filledInfoToken(character, 'selected-you', 1)?.characterIds).toEqual(['harlot']);
		});

		it("if they agree, the Harlot is shown the chosen player's character", () => {
			// Wiki: "If they nodded their head yes, wake the Harlot and show them the chosen player’s
			// character token."
			expect(cards()).toContain('this-player-is');
			const s = scenario(['harlot', 'sage', 'chef', 'witch', 'nodashii']);
			const shown = withChosen(
				filledInfoToken(character, 'this-player-is', 1)!,
				s.characters.get('witch')!
			);
			expect(shown.characterIds).toEqual(['witch']);
		});

		it('may mark both players Dead', () => {
			// Wiki: "You may decide that both players die—mark them with DEAD reminders."
			const dead = { tokens: [{ label: 'Dead', action: 'place' }] };
			expect(placeholdersFor(character, 'other')).toEqual([dead, dead]);
			const s = scenario(['harlot', 'sage', 'chef', 'witch', 'nodashii']);
			const token = { characterId: 'harlot', label: 'Dead' };
			expect(reminderTargetMisses(s.game, token, s.seat('harlot'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('sage'), s.characters)).toEqual([]);
		});
	});
});
