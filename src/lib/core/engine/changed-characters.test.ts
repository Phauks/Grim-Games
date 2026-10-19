/**
 * Who changed character since dawn, for the night order's wake steps. The player learns
 * their new character: https://wiki.bloodontheclocktower.com/Imp (the new Imp is shown the
 * Imp token), https://wiki.bloodontheclocktower.com/Pit-Hag.
 */
import { describe, expect, it } from 'vitest';
import { castGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from './commands.ts';
import { changedCharacters } from './changed-characters.ts';
import { undo } from './log.ts';

const TB = ['chef', 'empath', 'monk', 'mayor', 'poisoner', 'imp'];
const become =
	(i: number, characterId: string) =>
	(s: string[]): Command => ({ type: 'AssignCharacter', seatId: s[i], characterId });

describe('changedCharacters', () => {
	it('lists nothing before the first New day: the first night is still setup', () => {
		const { session } = castGame(TB, become(0, 'empath'));
		expect(changedCharacters(session.log, session.game)).toEqual([]);
	});

	it('lists a Minion who became the Imp since dawn', () => {
		const { session, ctx, seats } = castGame(TB, { type: 'NewDay' });
		const s = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[5], dead: true, cause: 'demon' },
			{ type: 'AssignCharacter', seatId: seats[4], characterId: 'imp' }
		);
		expect(changedCharacters(s.log, s.game)).toEqual([
			{ seatId: seats[4], from: 'poisoner', characterId: 'imp' }
		]);
	});

	it('forgets a change made before dawn, changed back, or undone', () => {
		const { session, ctx, seats } = castGame(TB, become(0, 'monk'), { type: 'NewDay' });
		expect(changedCharacters(session.log, session.game)).toEqual([]);
		const back = run(session, ctx, become(1, 'chef')(seats), become(1, 'empath')(seats));
		expect(changedCharacters(back.log, back.game)).toEqual([]);
		const changed = run(session, ctx, become(2, 'mayor')(seats));
		const undone = undo(changed);
		expect(changedCharacters(undone.log, undone.game)).toEqual([]);
	});
});
