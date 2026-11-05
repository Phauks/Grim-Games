/** Counting reminders that move at dawn or dusk (plan M53, `counters.ts`). */
import { describe, expect, it } from 'vitest';
import type { Script } from '#lib/core/data/types.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { refused, warned } from '#lib/core/model/fixtures.test-support.ts';
import { GENERIC_REMINDER_ID, numberSymbol } from '#lib/core/model/index.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { counterMoves } from './counters.ts';

const official = (id: string) => ({ kind: 'official' as const, id });
const script = (ids: string[]): Script => ({ entries: ids.map(official) });

/** The labels of `characterId`'s reminders, seat by seat. */
function labelsOf(s: Scenario, characterId: string): string[] {
	return s.game.seating.flatMap((id) =>
		s.game.seats[id].reminders.filter((r) => r.characterId === characterId).map((r) => r.label)
	);
}

const dawn = (s: Scenario) => s.newDay().do({ type: 'AdvanceCounters', at: 'dawn' });
const dusk = (s: Scenario) => s.dusk().do({ type: 'AdvanceCounters', at: 'dusk' });

describe('counter rules', () => {
	it('reads a run of the character own reminders, and reports the rest', () => {
		const ok = parseCharacterRules(
			{ counter: { tokens: ['Day 1', 'Day 2'], at: 'dawn', replaces: true } },
			'rules',
			new Issues(),
			['Day 1', 'Day 2']
		);
		expect(ok?.counter).toEqual({ tokens: ['Day 1', 'Day 2'], at: 'dawn', replaces: true });
		const issues = new Issues();
		parseCharacterRules({ counter: { tokens: ['Day 9'], at: 'noon', extra: 1 } }, 'rules', issues, [
			'Day 1'
		]);
		expect(issues.list).toHaveLength(3);
	});
});

describe('counterMoves', () => {
	it('swaps the Leviathan day token for the next at each dawn', () => {
		// https://wiki.bloodontheclocktower.com/Leviathan
		// Wiki: "Mark the Leviathan with the '''DAY 1''' reminder. At the beginning of each following day, mark the Leviathan with '''DAY 2''', then '''DAY 3''', then '''DAY 4''', then '''DAY 5''' reminders."
		const s = scenario(['leviathan', 'chef', 'empath', 'monk', 'soldier'], {
			script: script(['leviathan', 'chef', 'empath', 'monk', 'soldier'])
		});
		const day1 = dawn(s);
		expect(labelsOf(day1, 'leviathan')).toEqual(['Day 1']);
		// Nothing moves for the Leviathan at dusk.
		expect(counterMoves(day1.dusk().game, s.characters, 'dusk')).toEqual([]);
		const day2 = dawn(day1.dusk());
		expect(labelsOf(day2, 'leviathan')).toEqual(['Day 2']);
		expect(day2.game.seats[day2.seat('leviathan')].reminders).toHaveLength(1);
		// Past day 5 there is no next token.
		let day5 = day2;
		for (let i = 0; i < 3; i++) day5 = dawn(day5.dusk());
		expect(labelsOf(day5, 'leviathan')).toEqual(['Day 5']);
		expect(counterMoves(day5.dusk().newDay().game, s.characters, 'dawn')).toEqual([]);
	});

	it('adds the Riot next day token beside the last', () => {
		// https://wiki.bloodontheclocktower.com/Riot
		// Wiki: "On the 1st day, add the '''DAY 1''' reminder to the Grimoire. On the 2nd day, add the '''DAY 2''' reminder to the Grimoire. On the 3rd day, add the '''DAY 3''' reminder to the Grimoire."
		const cast = ['riot', 'chef', 'empath', 'monk', 'soldier'];
		const s = scenario(cast, { script: script(cast) });
		const day2 = dawn(dawn(s).dusk());
		expect(labelsOf(day2, 'riot')).toEqual(['Day 1', 'Day 2']);
		// A token the Storyteller already placed is not placed again.
		const placed = s.newDay().reminder('riot', 'riot', 'Day 1');
		expect(counterMoves(placed.game, s.characters, 'dawn')).toEqual([]);
	});

	it('adds the Summoner and Xaan next night token at dusk', () => {
		// https://wiki.bloodontheclocktower.com/Summoner
		// Wiki: "When preparing the second night, put the Summoner’s '''NIGHT 2''' reminder by the Summoner."
		// https://wiki.bloodontheclocktower.com/Xaan
		// Wiki: "On the 2nd night, add the '''NIGHT 2''' Xaan reminder to the Grimoire."
		const cast = ['summoner', 'xaan', 'chef', 'empath', 'monk'];
		const s = scenario(cast, { script: script(cast) });
		const night2 = dusk(s.newDay());
		expect(labelsOf(night2, 'summoner')).toEqual(['Night 2']);
		expect(labelsOf(night2, 'xaan')).toEqual(['Night 2']);
		expect(counterMoves(night2.newDay().game, s.characters, 'dawn')).toEqual([]);
	});

	it('leaves the board alone when no counter is in play', () => {
		const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).newDay();
		expect(warned(s.session, s.ctx, { type: 'AdvanceCounters', at: 'dawn' })).toEqual([
			'no-change'
		]);
	});
});

describe('number tokens that count up', () => {
	const numbered = (n: number) =>
		scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).do((s) => ({
			type: 'AddReminder',
			seatId: s.seat('chef'),
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' },
			look: { symbol: numberSymbol(n) }
		}));
	const tokenOf = (s: Scenario) => s.game.seats[s.seat('chef')].reminders[0];

	it('goes up by one at the dusk or dawn the Storyteller picked', () => {
		const s = numbered(3);
		const counting = s.do({
			type: 'SetReminderCountsUp',
			reminderId: tokenOf(s).reminderId,
			countsUp: 'dusk'
		});
		expect(tokenOf(counting).countsUp).toBe('dusk');
		expect(tokenOf(dawn(counting)).symbol).toBe('#3');
		expect(tokenOf(dusk(counting)).symbol).toBe('#4');
		const stopped = counting.do({ type: 'SetReminderCountsUp', reminderId: tokenOf(s).reminderId });
		expect(tokenOf(stopped).countsUp).toBeUndefined();
		expect(tokenOf(dusk(stopped)).symbol).toBe('#3');
	});

	it('stops at the highest number', () => {
		const s = numbered(20);
		const counting = s.do({
			type: 'SetReminderCountsUp',
			reminderId: tokenOf(s).reminderId,
			countsUp: 'dawn'
		});
		expect(counterMoves(counting.newDay().game, s.characters, 'dawn')).toEqual([]);
	});

	it('only a number token counts up', () => {
		const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).do((at) => ({
			type: 'AddReminder',
			seatId: at.seat('chef'),
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' },
			look: { symbol: '★' }
		}));
		expect(
			refused(s.session, s.ctx, {
				type: 'SetReminderCountsUp',
				reminderId: tokenOf(s).reminderId,
				countsUp: 'dawn'
			})
		).toBe('invalid-counts-up');
	});
});
