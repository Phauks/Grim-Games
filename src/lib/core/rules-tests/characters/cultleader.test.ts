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
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
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
		it('Example 1: Good wins after unanimous day-three cult vote', () => {
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
			// Every good player joined: the Storyteller records the cult vote as passed.
			const joined = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('cultleader'),
				characterId: 'cultleader',
				passed: true
			}));
			expect(gameEnds(joined.game, joined.characters)).toMatchObject([
				{ rule: 'cult-joined', winner: 'good', characterId: 'cultleader' }
			]);
		});
		it("Example 2: Poisoned Cult Leader's full vote changes nothing", () => {
			// Wiki: "The Cult Leader neighbors the No Dashii. On day 2, the Cult Leader attempts to form
			// a cult. All players vote to join the cult, but a cult is not formed, because the Cult
			// Leader is poisoned."
			const s = scenario(['cultleader', 'nodashii', 'chef', 'monk', 'poisoner'])
				.newDay()
				.newDay()
				.poisoned('cultleader');
			expect(abilityState(s.game, s.seat('cultleader'), s.characters).works).toBe(false);
			// Everyone joined, but the poisoned Cult Leader's cult is not formed: the game end is
			// only offered as the Storyteller's call.
			const joined = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('cultleader'),
				characterId: 'cultleader',
				passed: true
			}));
			expect(gameEnds(joined.game, joined.characters)).toMatchObject([
				{ rule: 'cult-joined', holds: [{ rule: 'impaired' }] }
			]);
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Cult_Leader#How_to_Run)', () => {
		const cultVote = (at: Scenario, passed: boolean) =>
			at.do((s) => ({
				type: 'UseAbility',
				seatId: s.seat('cultleader'),
				characterId: 'cultleader',
				passed
			}));

		it('takes the alignment of its living neighbours, skipping the dead', () => {
			// Wiki: "Each night, turn the Cult Leader character token right side up (if both alive
			// neighbors are good) or upside down (if both alive neighbors are evil) or either (if one
			// alive neighbor is good and the other alive neighbor is evil)."
			const s = scenario(['cultleader', 'chef', 'monk', 'empath', 'imp']);
			expect(neighbourAlignments(s.game, 'cultleader', s.characters)?.alignments).toEqual([
				'evil',
				'good'
			]);
			const dead = s.dies('imp', 'execution');
			expect(neighbourAlignments(dead.game, 'cultleader', dead.characters)?.alignments).toEqual([
				'good'
			]);
		});

		it("a passed cult vote wins for the Cult Leader's team, evil too", () => {
			// Wiki: "During the day, the Cult Leader may declare that they wish to use their ability. If
			// so, enter the circle and run a vote in the same way that you would for an Exile. If all good
			// players raise their hand, declare which team has won."
			const evil = scenario(['cultleader', 'chef', 'imp', 'poisoner', 'empath', 'monk'])
				.newDay()
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('cultleader'), alignment: 'evil' }));
			const joined = cultVote(evil, true);
			expect(gameEnds(joined.game, joined.characters)).toMatchObject([
				{ rule: 'cult-joined', winner: 'evil', characterId: 'cultleader' }
			]);
		});

		it('a cult vote that not every good player joins ends nothing', () => {
			// Wiki: "If not all good players raise their hand, nothing happens."
			const s = cultVote(
				scenario(['cultleader', 'chef', 'imp', 'poisoner', 'empath', 'monk']).newDay(),
				false
			);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
	});
});
