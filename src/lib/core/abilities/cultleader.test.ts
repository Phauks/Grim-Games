/**
 * Cult Leader: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Cult_Leader
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Cult Leader.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { neighbourAlignments } from '#lib/core/rules/becomes.ts';
import { endCharacters } from '#lib/core/rules/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Cult Leader', () => {
	const character = committedCharacter('cultleader');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Cult Leader');
			expect(character.type).toBe('townsfolk');
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

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('cultleader')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Cult_Leader#Examples)', () => {
		it.fails('Example 1: Good wins after unanimous day-three cult vote', () => {
			// Wiki: "On day 3, the good Cult Leader’s living neighbors are the good Town Crier and the
			// evil Goblin. The Cult Leader requests to form a cult, and all good players vote to join
			// the cult. The game ends and the good team wins!"
			const s = scenario(['cultleader', 'towncrier', 'imp', 'chef', 'goblin'])
				.newDay()
				.newDay()
				.newDay();
			expect(neighbourAlignments(s.game, 'cultleader', s.characters)).toEqual({
				seatId: s.seat('cultleader'),
				alignments: ['evil', 'good']
			});
			expect(alignmentOf(s.game, s.seat('cultleader'))).toBe('good');
			expect(endCharacters(s.game, s.characters)).toContain('cultleader');
			engineGap(
				'M9',
				"a cult vote: when every good player joins a good Cult Leader's cult, good wins"
			);
		});
		it.fails("Example 2: Poisoned Cult Leader's full vote changes nothing", () => {
			// Wiki: "The Cult Leader neighbors the No Dashii. On day 2, the Cult Leader attempts to form
			// a cult. All players vote to join the cult, but a cult is not formed, because the Cult
			// Leader is poisoned."
			const s = scenario(['cultleader', 'nodashii', 'chef', 'monk', 'poisoner'])
				.newDay()
				.newDay()
				.poisoned('cultleader');
			expect(abilityState(s.game, s.seat('cultleader'), s.characters).works).toBe(false);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			engineGap('M9', "a cult vote: a drunk or poisoned Cult Leader's cult is never formed");
		});
		it('Example 3: Poisoned Cult Leader stays good despite evil neighbours', () => {
			// Wiki: "The Cult Leader’s living neighbors are the evil Poisoner and the good Fortune
			// Teller. The Poisoner chooses the Cult Leader, and the Kazali kills the Fortune Teller.
			// The Cult Leader’s living neighbors are now the evil Poisoner and the evil Wizard. While
			// the Cult Leader’s living neighbors are both evil, the Cult Leader doesn’t turn evil,
			// because they cannot change alignment while poisoned."
			// The engine warns rather than refuses: the poisoned Cult Leader is flagged as having no
			// working ability, and nothing turns them evil.
			const s = scenario(['cultleader', 'poisoner', 'kazali', 'wizard', 'fortuneteller'])
				.poisoned('cultleader')
				.dies('fortuneteller', 'kazali');
			expect(neighbourAlignments(s.game, 'cultleader', s.characters)?.alignments).toEqual(['evil']);
			expect(abilityState(s.game, s.seat('cultleader'), s.characters).works).toBe(false);
			expect(alignmentOf(s.game, s.seat('cultleader'))).toBe('good');
		});
	});
});
