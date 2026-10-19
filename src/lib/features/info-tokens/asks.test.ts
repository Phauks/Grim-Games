import { describe, expect, it } from 'vitest';
import { askBadges } from './asks.ts';

const characters = (asks: Parameters<typeof askBadges>[0]) =>
	askBadges(asks).find((badge) => badge.icon === 'asksCharacters');

describe('the characters a card asks for', () => {
	// Trevor (2026-10-18): a count is exact, or a range.
	it('shows an exact count as one number', () => {
		expect(characters({ characters: 3, exactly: true })).toMatchObject({
			count: '3',
			label: 'Asks for 3 characters'
		});
		expect(characters({ characters: 1 })).toMatchObject({ count: '1' });
	});

	it('shows a range from one, or from its lowest', () => {
		expect(characters({ characters: 3 })).toMatchObject({
			count: '1–3',
			label: 'Asks for 1 to 3 characters'
		});
		expect(characters({ characters: 4, fewest: 2 })).toMatchObject({
			count: '2–4',
			label: 'Asks for 2 to 4 characters'
		});
	});
});
