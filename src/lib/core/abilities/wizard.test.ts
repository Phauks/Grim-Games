/**
 * Wizard: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Wizard
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Wizard.
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
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { infoPicker } from '#lib/core/rules/night-info.ts';
import { wishes } from '#lib/core/rules/wishes.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The Wizard's day reminders, as plain text. */
const wizardLines = (s: Scenario) =>
	dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders.filter((r) => r.characterId === 'wizard').map((r) => renderReminder(r.segments))
	);

describe('Wizard', () => {
	const character = committedCharacter('wizard');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Wizard');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['?', '?']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('wizard')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Wizard#Examples)', () => {
		it('Example 1: Wizard asks to view the Grimoire', () => {
			// Wiki: "The Wizard wishes to see the Grimoire. The Storyteller grants this wish, and there
			// is no price and no clue."
			const before = scenario(['wizard', 'chef', 'empath', 'poisoner', 'imp']);
			expect(wizardLines(before).join(' ')).toMatch(/wish/);
			const s = before.do((at) => ({
				type: 'RecordWish',
				seatId: at.seat('wizard'),
				characterId: 'wizard',
				text: 'To see the Grimoire',
				granted: true
			}));
			expect(wishes(s.game)).toMatchObject([{ granted: true, text: 'To see the Grimoire' }]);
			expect(wishes(s.game)[0]).not.toHaveProperty('price');
			expect(wishes(s.game)[0]).not.toHaveProperty('clue');
			// Granted: the reminder that they may still wish goes.
			expect(wizardLines(s)).toEqual([]);
		});
		it('Example 2: Every good player drunk, info falsified', () => {
			// Wiki: "The Wizard wishes that all good players are drunk. The Storyteller grants the
			// wish. Later, they declare that the Wizard has made a wish and that “Things are wrong” but
			// provide no further context. For the rest of the game, the Storyteller makes all
			// information false."
			const s = scenario(['wizard', 'chef', 'empath', 'poisoner', 'imp'])
				.do((at) => ({
					type: 'RecordWish',
					seatId: at.seat('wizard'),
					characterId: 'wizard',
					text: 'All good players are drunk',
					granted: true,
					clue: 'Things are wrong',
					effect: 'good-drunk'
				}))
				.newDay()
				.newDay();
			// Days later, every good player's information is still unreliable.
			for (const id of ['chef', 'empath'] as const) {
				const picker = infoPicker(s.game, s.seat(id), id, s.characters)!;
				expect(picker).toMatchObject({ unreliable: 'drunk', anyAllowed: true });
				expect(picker.impairments[0].source).toMatchObject({ characterId: 'wizard' });
			}
			// Evil players are not drunk.
			expect(abilityState(s.game, s.seat('poisoner'), s.characters).works).toBe(true);
			expect(wishes(s.game)[0]).toMatchObject({ clue: 'Things are wrong' });
		});
		it('Example 3: Wizard becomes Demon, replacing the Lord of Typhon', () => {
			// Wiki: "The Wizard wishes that they become a Demon. The Storyteller grants the wish. Later,
			// they declare that the Wizard has made a wish, and that “The student has become the
			// master.” The Storyteller kills the Lord of Typhon and turns the Wizard into the Ojo."
			const s = scenario(['wizard', 'chef', 'poisoner', 'lordoftyphon', 'witch', 'empath'])
				.dies('lordoftyphon')
				.becomes('wizard', 'ojo', 'evil');
			// The Wizard's player is the Demon now, so the Lord of Typhon's death doesn't end the game.
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it('Example 4: Wish for victory, narrowed to three suspects', () => {
			// Wiki: "The Wizard wishes to win the game. The Storyteller grants the wish, and tells the
			// Wizard that the evil team will win the game at the end of the day. The Storyteller
			// declares that the Wizard has made a wish, and that either Ben, Amy, or Lewis is the
			// Demon. The group executes Ben, who is the Demon, and good wins."
			const s = scenario(['wizard', 'imp', 'chef', 'empath', 'poisoner', 'monk'])
				.newDay()
				.execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});
		it('Example 5: Wish for five lives declined as too awkward', () => {
			// Wiki: "The Wizard wishes that all players have 5 lives, and all reminder tokens for the
			// script are added to characters. The Storyteller judges that this wish is too awkward,
			// confusing and boring, declines the wish, and asks the Wizard to wish again."
			const s = scenario(['wizard', 'chef', 'empath', 'poisoner', 'imp']).do((at) => ({
				type: 'RecordWish',
				seatId: at.seat('wizard'),
				characterId: 'wizard',
				text: 'All players have 5 lives',
				granted: false
			}));
			expect(wishes(s.game)).toMatchObject([{ granted: false }]);
			// Declined: they may still make a wish.
			expect(wizardLines(s).join(' ')).toMatch(/wish/);
		});
	});
});
