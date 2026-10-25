/**
 * Players' feedback kept on the Storyteller's device with the finished game (Trevor,
 * 2026-10-25), so it outlasts the room.
 */
import { describe, expect, it } from 'vitest';
import { emptyFeedback, type GameFeedback } from './feedback.ts';
import {
	SAVED_FEEDBACK_VERSION,
	mergeFeedback,
	parseSavedFeedback,
	savedFeedback
} from './saved.ts';

const feedback = (extra: Partial<GameFeedback>): GameFeedback => ({ ...emptyFeedback(), ...extra });
const rated = feedback({ rating: 4, anonymous: false, accolades: ['pacing'] });
const anonymous = feedback({ comment: 'Great night' });

describe('saved game feedback', () => {
	it('adds new entries in the order they came and replaces a resent one by id', () => {
		const first = mergeFeedback([], [{ id: 'f1', feedback: rated, name: 'Alex', seatId: 'a' }]);
		const second = mergeFeedback(first, [
			{ id: 'f2', feedback: anonymous },
			{ id: 'f1', feedback: { ...rated, rating: 2.5 }, name: 'Alex', seatId: 'a' }
		]);
		expect(second).toEqual([
			{ id: 'f1', feedback: { ...rated, rating: 2.5 }, name: 'Alex', seatId: 'a' },
			{ id: 'f2', feedback: anonymous }
		]);
		// Feedback the room no longer sends stays saved.
		expect(mergeFeedback(second, [])).toEqual(second);
	});

	it('drops what is not feedback and never keeps who sent anonymous feedback', () => {
		expect(
			mergeFeedback(
				[],
				[
					null,
					{ id: '', feedback: rated },
					{ id: 'f1', feedback: { version: 99 } },
					{ id: 'f2', feedback: anonymous, name: 'Sam', seatId: 'b' },
					{ id: 'f3', feedback: rated, name: '  ', seatId: 7 }
				]
			)
		).toEqual([
			{ id: 'f2', feedback: anonymous },
			{ id: 'f3', feedback: rated }
		]);
	});

	it('reads back what it saved and ignores another version or damage', () => {
		const entries = [{ id: 'f1', feedback: rated, name: 'Alex' }];
		const stored = JSON.parse(JSON.stringify(savedFeedback(entries))) as unknown;
		expect(stored).toMatchObject({ version: SAVED_FEEDBACK_VERSION });
		expect(parseSavedFeedback(stored)).toEqual(entries);
		expect(parseSavedFeedback({ version: 2, entries })).toEqual([]);
		expect(parseSavedFeedback({ version: SAVED_FEEDBACK_VERSION, entries: 'x' })).toEqual([]);
		expect(parseSavedFeedback(null)).toEqual([]);
	});
});
