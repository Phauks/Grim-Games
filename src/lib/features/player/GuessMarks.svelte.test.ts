import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '#lib/ui/base.css';
import type { GuessMark } from './grim-guesses.ts';
import GuessMarks from './GuessMarks.svelte';

const good: GuessMark = { generic: { key: 'good', team: 'good' }, label: 'Good' } as GuessMark;
const evil: GuessMark = { generic: { key: 'evil', team: 'evil' }, label: 'Evil' } as GuessMark;

function pill(others: GuessMark[]) {
	const screen = render(GuessMarks, { others });
	// Placed as SeatDisc places it: inside a token-sized box that sets --size.
	const host = screen.container;
	host.style.setProperty('--size', '64px');
	host.style.position = 'relative';
	return screen;
}

describe('GuessMarks', () => {
	// Trevor (2026-10-29): the next guess, and a "+N" count when more wait behind it, with no
	// cycle arrow; at most two slots, so it never reaches the next seat.
	it('shows only the next guess when there is one other', async () => {
		const screen = pill([good]);
		await expect.element(screen.getByTestId('guess-mark')).toBeVisible();
		expect(screen.container.querySelectorAll('[data-testid="guess-mark"]')).toHaveLength(1);
		expect(screen.container.querySelector('[data-testid="more-guesses"]')).toBeNull();
	});

	it('counts the guesses behind the next one, in one more slot', async () => {
		const one = pill([good]);
		const width = one.getByTestId('guess-marks').element().getBoundingClientRect().width;
		one.unmount();
		const two = pill([good, evil]);
		const twoWidth = two.getByTestId('guess-marks').element().getBoundingClientRect().width;
		await expect.element(two.getByTestId('more-guesses')).toHaveTextContent('+1');
		two.unmount();

		const screen = pill([good, evil, good, evil]);
		const more = screen.getByTestId('more-guesses');
		await expect.element(more).toHaveTextContent('+3');
		await expect.element(more).toHaveAccessibleName('3 more guesses');
		expect(screen.container.querySelectorAll('[data-testid="guess-mark"]')).toHaveLength(1);
		const wide = screen.getByTestId('guess-marks').element().getBoundingClientRect().width;
		expect(twoWidth).toBeGreaterThan(width);
		expect(Math.abs(wide - twoWidth)).toBeLessThan(1);
	});
});
