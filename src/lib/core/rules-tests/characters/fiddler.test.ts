/**
 * Fiddler: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fiddler
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fiddler.
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
import { endCharacters } from '#lib/core/rules/game-end/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import {
	dayReminders,
	dayStateFromGame,
	renderReminder
} from '#lib/core/rules/day/day-reminders.ts';
import {
	contestChoosers,
	contestOpponents,
	contestWinner,
	ruleCharacterUse
} from '#lib/core/rules/game-end/contest.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fiddler', () => {
	const character = committedCharacter('fiddler');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Fiddler');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('fiddler')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'ability', name: 'pointing', time: 'day' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fiddler#Examples)', () => {
		it('Example 1: Timed game ends; good wins', () => {
			// Wiki: "The game begins but will need to end in 45 minutes due to a freak lightning
			// storm approaching the neighbourhood, so the Storyteller adds the Fiddler. After 40
			// minutes, the Fiddler activates. The players choose the good player to win, so good
			// wins."
			// The Fiddler's contest is the Storyteller's to judge: End game offers it, and no rule
			// ends the game by itself.
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']).rule('fiddler');
			expect(endCharacters(s.game, s.characters)).toContain('fiddler');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it('Example 2: Endless stalemate resolved by Fiddler contest', () => {
			// Wiki: "There are just four players left alive. Each day, nobody nominates. Each
			// night, the Demon chooses a dead player to kill. Since this could go on indefinitely,
			// the Storyteller adds the Fiddler so that
			// the game can end."
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp'])
				.dies('empath')
				.dies('monk')
				.dies('mayor');
			expect(endCharacters(s.game, s.characters)).not.toContain('fiddler');
			const added = s.rule('fiddler');
			expect(endCharacters(added.game, added.characters)).toContain('fiddler');
			expect(gameEnds(added.game, added.characters)).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Fiddler#How_to_Run)', () => {
		it('can be added during the game, and the day panel then shows it', () => {
			// Wiki: "At any time, if you expect to run out of time, declare that the Fiddler is in play
			// and declare the time when the game will end. Add the Fiddler token to the Grimoire."
			const lines = (s: ReturnType<typeof scenario>) =>
				dayReminders(
					dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
				).groups.flatMap((g) =>
					g.reminders
						.filter((r) => r.characterId === 'fiddler')
						.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
				);
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']).newDay();
			expect(lines(s)).toEqual([]);
			expect(lines(s.rule('fiddler'))).toEqual([
				{ group: 'day-ability', text: '[fiddler] is in play' }
			]);
		});

		it('has the Demon choose a player of the other alignment for the fiddle contest', () => {
			// Wiki: "Wake the Demon. They point at any good player. (If the Demon is good, they must
			// choose an evil player instead.)"
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']).rule('fiddler');
			expect(endCharacters(s.game, s.characters)).toContain('fiddler');
			const good = (['chef', 'empath', 'monk', 'soldier'] as const).map((id) => s.seat(id));
			expect(contestOpponents(s.game, 'fiddler', s.seat('imp'), s.characters)).toEqual(good);
			// A good Demon chooses an evil player instead.
			const turned = s.do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('imp'),
				alignment: 'good'
			}));
			expect(
				contestOpponents(turned.game, 'fiddler', turned.seat('imp'), turned.characters)
			).toEqual([turned.seat('poisoner')]);
		});

		it('offers the contest on its day panel row, with the Demon choosing', () => {
			// Wiki: "Wake the Demon. They point at any good player. (If the Demon is good, they must
			// choose an evil player instead.)"
			// The fiddle contest is its own dialog from the Fiddler's row (Trevor, 2026-11-03).
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']).rule('fiddler');
			expect(ruleCharacterUse(s.game, 'fiddler', s.characters)).toBe('contest');
			expect(ruleCharacterUse(s.game, 'doomsayer', s.characters)).toBe('anyone');
			expect(ruleCharacterUse(s.game, 'djinn', s.characters)).toBeUndefined();
			expect(contestChoosers(s.game, 'fiddler', s.characters)).toEqual([s.seat('imp')]);
		});

		it('gives the win to the evil team when the fiddle contest vote ties', () => {
			// Wiki: "The player with the most votes wins, their team wins, and the game ends. On a tie,
			// the evil team wins."
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']).rule('fiddler');
			const demon = { seatId: s.seat('imp'), votes: 3 };
			const chef = { seatId: s.seat('chef'), votes: 3 };
			expect(contestWinner(s.game, 'fiddler', demon, chef, s.characters)).toBe('evil');
			expect(contestWinner(s.game, 'fiddler', demon, { ...chef, votes: 4 }, s.characters)).toBe(
				'good'
			);
			expect(contestWinner(s.game, 'fiddler', { ...demon, votes: 4 }, chef, s.characters)).toBe(
				'evil'
			);
		});
	});
});
