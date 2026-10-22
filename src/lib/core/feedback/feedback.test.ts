/**
 * Post-game feedback: half-star ratings, Storyteller-only accolades (Trevor, 2026-10-20 and
 * 2026-10-22) and a short comment, anonymous by default.
 */
import { describe, expect, it } from 'vitest';
import {
	ACCOLADES,
	FEEDBACK_VERSION,
	MAX_COMMENT_LENGTH,
	emptyFeedback,
	hasFeedback,
	isRating,
	parseFeedback,
	summarizeFeedback,
	toggleAccolade,
	type GameFeedback
} from './feedback.ts';

const feedback = (extra: Partial<GameFeedback>): GameFeedback => ({ ...emptyFeedback(), ...extra });

describe('post-game feedback', () => {
	it('has the seven approved accolades', () => {
		expect(ACCOLADES.map((a) => a.emoji).join('')).toBe('⏱️⚖️🌀💡🕯️🧩🔥');
	});

	it('starts empty and anonymous', () => {
		expect(emptyFeedback()).toEqual({ version: FEEDBACK_VERSION, accolades: [], anonymous: true });
		expect(hasFeedback(emptyFeedback())).toBe(false);
		expect(hasFeedback(feedback({ rating: 0.5 }))).toBe(true);
		expect(hasFeedback(feedback({ comment: 'Loved it' }))).toBe(true);
	});

	it('rates in half stars from 0.5 to 5', () => {
		expect([0.5, 1, 3.5, 5].every(isRating)).toBe(true);
		expect([0, -1, 5.5, 3.25, Number.NaN, '4'].some(isRating)).toBe(false);
	});

	it('toggles accolades in list order', () => {
		let f = toggleAccolade(emptyFeedback(), 'final-day');
		f = toggleAccolade(f, 'pacing');
		expect(f.accolades).toEqual(['pacing', 'final-day']);
		expect(toggleAccolade(f, 'pacing').accolades).toEqual(['final-day']);
	});

	it('checks feedback from elsewhere', () => {
		expect(
			parseFeedback({
				version: FEEDBACK_VERSION,
				rating: 4.5,
				accolades: ['twist', 'nope', 'pacing', 'twist'],
				comment: `  ${'x'.repeat(MAX_COMMENT_LENGTH + 10)}  `
			})
		).toEqual({
			version: FEEDBACK_VERSION,
			rating: 4.5,
			accolades: ['pacing', 'twist'],
			comment: 'x'.repeat(MAX_COMMENT_LENGTH),
			anonymous: true
		});
		expect(parseFeedback({ version: FEEDBACK_VERSION, rating: 4.2, anonymous: false })).toEqual(
			feedback({ anonymous: false })
		);
		expect(parseFeedback({ version: 99 })).toBeUndefined();
		expect(parseFeedback('5 stars')).toBeUndefined();
		expect(parseFeedback(null)).toBeUndefined();
	});

	it('sums up a game for the Storyteller', () => {
		const summary = summarizeFeedback([
			feedback({ rating: 5, accolades: ['pacing'] }),
			feedback({ rating: 3.5, accolades: ['pacing', 'twist'] }),
			feedback({ comment: 'Great night' })
		]);
		expect(summary.count).toBe(3);
		expect(summary.ratings).toBe(2);
		expect(summary.rating).toBe(4.5);
		expect(summary.accolades.slice(0, 3)).toEqual([
			{ id: 'pacing', count: 2 },
			{ id: 'fair', count: 0 },
			{ id: 'twist', count: 1 }
		]);
		expect(summarizeFeedback([]).rating).toBeUndefined();
	});
});
