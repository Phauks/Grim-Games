import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '#lib/ui/base.css';
import type { Character } from '#lib/core/data/index.ts';
import type { Seat } from '#lib/core/model/index.ts';
import SeatToken from './SeatToken.svelte';

const chef: Character = {
	id: 'chef',
	name: 'Chef',
	type: 'townsfolk',
	ability: '',
	setup: false,
	reminders: [],
	remindersGlobal: [],
	special: []
};

const seat = {
	seatId: 's1',
	playerName: 'Alex Kim',
	characterId: 'chef',
	alignment: 'good',
	dead: false,
	ghostVoteUsed: false,
	overrides: [],
	avatar: 'initials',
	reminders: []
} as unknown as Seat;

function overlap(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe('SeatToken top marks', () => {
	// Trevor (2026-10-28): nominations top left, the orphan warning top middle, the avatar top
	// right, each in a fixed place so none moves when another appears.
	for (const size of [44, 64, 96]) {
		it(`keeps the nomination marks, orphan warning and avatar apart at ${size}px`, async () => {
			const screen = render(SeatToken, {
				seat,
				number: 1,
				character: chef,
				size,
				orphan: true,
				nominations: { made: false, received: false },
				onTap: () => {}
			});
			const rect = (id: string) => screen.getByTestId(id).element().getBoundingClientRect();
			const disc = screen.container.querySelector('.disc')!.getBoundingClientRect();
			const marks = rect('nomination-marks');
			const orphan = rect('orphan-mark');
			const avatar = rect('avatar-mark');

			expect(marks.right).toBeLessThan(disc.left + disc.width / 2);
			expect(avatar.left).toBeGreaterThan(disc.left + disc.width / 2);
			expect(avatar.bottom).toBeLessThan(disc.top + disc.height / 2);
			expect(overlap(marks, avatar)).toBe(false);
			// The orphan warning is rare; at the smallest token it may touch, never cover.
			const slack = size < 56 ? 4 : 0;
			expect(orphan.left + slack).toBeGreaterThanOrEqual(marks.right);
			expect(orphan.right - slack).toBeLessThanOrEqual(avatar.left);
		});
	}

	it('keeps the avatar top right with nominations off', async () => {
		const screen = render(SeatToken, {
			seat,
			number: 1,
			character: chef,
			size: 64,
			orphan: false,
			onTap: () => {}
		});
		const disc = screen.container.querySelector('.disc')!.getBoundingClientRect();
		const avatar = screen.getByTestId('avatar-mark').element().getBoundingClientRect();
		expect(avatar.left).toBeGreaterThan(disc.left + disc.width / 2);
		expect(avatar.bottom).toBeLessThan(disc.top + disc.height / 2);
	});
});
