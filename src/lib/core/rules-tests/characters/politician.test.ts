/**
 * Politician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Politician
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Politician.
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
import { alwaysWinners, endCharacters, joinsWinners } from '#lib/core/rules/game-end/end-reason.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Politician', () => {
	const character = committedCharacter('politician');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Politician');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('politician')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Politician#Examples)', () => {
		it('Example 1: Politician blocks execution; bluffing Mayor wins', () => {
			// Wiki: "The Politician has been trying to execute the Demon all game, without success.
			// With just three players alive, the Politician convinces the group to not execute, since
			// someone is claiming to be the Mayor. There is no execution, and evil wins because a
			// Minion was bluffing as the Mayor. The Politician wins too."
			// The Poisoner bluffs the Mayor; the Imp kills the Politician that night.
			const s = scenario(['politician', 'chef', 'empath', 'imp', 'poisoner', 'monk'])
				.dies('chef')
				.dies('empath')
				.dies('monk');
			// No real Mayor, so a day without an execution wins nothing for good.
			const dusk = gameEnds(s.game, s.characters, { dayEnded: true });
			expect(dusk.filter((e) => e.winner === 'good')).toEqual([]);
			const night = s.newDay().dies('politician', 'imp');
			expect(suggestedWinner(gameEnds(night.game, night.characters))).toBe('evil');
			// The Storyteller judges the Politician most responsible: End game offers it, and the
			// dead Politician may win with evil.
			expect(endCharacters(night.game, night.characters)).toContain('politician');
			expect(joinsWinners(night.game, night.characters, 'evil')).toEqual([s.seat('politician')]);
			expect(joinsWinners(night.game, night.characters, 'good')).toEqual([]);
		});
		it("Example 2: Politician's accusation fails; both lose", () => {
			// Wiki: "On the final day, the Politician votes for the Empath, and tells the group that
			// the Empath is evil. The Saint is executed instead. The Storyteller judges that the good
			// team lost due to their own actions as a group, not just the bad advice of the
			// Politician. Good loses, and the Politician loses."
			// Evil wins by the Saint, and the Politician stays good, so they lose with good.
			const s = scenario(['politician', 'empath', 'saint', 'imp', 'poisoner', 'monk'])
				.dies('monk')
				.execute('saint');
			const ends = gameEnds(s.game, s.characters);
			expect(suggestedWinner(ends)).toBe('evil');
			expect(ends.map((e) => e.rule)).toContain('executed-loses');
			expect(s.game.seats[s.seat('politician')].alignment).toBe('good');
		});
		it('Example 3: Atheist bluff gets Storyteller executed; evil wins', () => {
			// Wiki: "The Politician, believing that evil is winning, bluffs as the Atheist. The
			// Storyteller is executed. Evil wins, and the Politician wins too."
			// No Atheist is in play, so executing the Storyteller is a win for evil.
			const s = scenario(['politician', 'chef', 'empath', 'imp', 'poisoner']).do(
				(at) => ({ type: 'NominateStoryteller', nominator: at.seat('politician') }),
				{ type: 'ExecuteStoryteller' }
			);
			const ends = gameEnds(s.game, s.characters);
			expect(suggestedWinner(ends)).toBe('evil');
			expect(ends.map((e) => e.rule)).toEqual(['storyteller-executed']);
			expect(endCharacters(s.game, s.characters)).toContain('politician');
			expect(joinsWinners(s.game, s.characters, 'evil')).toEqual([s.seat('politician')]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Politician#How_to_Run)', () => {
		it('offers the Politician at the game end, alive or dead, for the Storyteller to judge', () => {
			// Wiki: "When the game ends, if good lost and you feel that this was significantly due to
			// the words and actions of the Politician player, declare that the Politician turns evil
			// and wins too."
			const s = scenario(['politician', 'chef', 'empath', 'imp', 'poisoner']);
			expect(endCharacters(s.game, s.characters)).toContain('politician');
			const dead = s.dies('politician', 'imp');
			expect(endCharacters(dead.game, dead.characters)).toContain('politician');
		});

		it('lets an evil Politician who lost the game for evil turn good and win', () => {
			// Wiki: "In the rare instance that the Politician is evil, and plays a big part in losing
			// the game for evil, declare that the Politician turns good and wins with the good team."
			const s = scenario(['politician', 'chef', 'empath', 'imp', 'poisoner'])
				.becomes('politician', 'politician', 'evil')
				.execute('imp');
			expect(suggestedWinner(gameEnds(s.game, s.characters))).toBe('good');
			expect(endCharacters(s.game, s.characters)).toContain('politician');
			// The Politician always wins with good (Trevor, 2026-11-03), so there is no call to make,
			// and their alignment does not change.
			expect(alwaysWinners(s.game, s.characters, 'good')).toEqual([s.seat('politician')]);
			expect(joinsWinners(s.game, s.characters, 'good')).toEqual([]);
			expect(s.game.seats[s.seat('politician')].alignment).toBe('evil');
		});
	});
});
