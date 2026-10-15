import { describe, expect, it } from 'vitest';
import { describeLeaves, leafLayout, MAX_TOP, TOP_STEP } from './leaves.ts';

describe('leafLayout', () => {
	it('puts the first-night leaf on the left and the other-nights leaf on the right', () => {
		expect(leafLayout({ firstNight: true, otherNight: true, reminders: 0, setup: false })).toEqual([
			{ angle: 180, kind: 'night' },
			{ angle: 0, kind: 'night' }
		]);
	});

	it('spreads one top leaf per reminder token around the top, setup leaf in the middle', () => {
		const leaves = leafLayout({ firstNight: false, otherNight: false, reminders: 2, setup: true });
		expect(leaves.map((l) => l.kind)).toEqual(['reminder', 'setup', 'reminder']);
		expect(leaves.map((l) => l.angle)).toEqual([-90 - TOP_STEP, -90, -90 + TOP_STEP]);
	});

	it('draws at most MAX_TOP top leaves', () => {
		const leaves = leafLayout({
			firstNight: false,
			otherNight: false,
			reminders: 20,
			setup: false
		});
		expect(leaves).toHaveLength(MAX_TOP);
	});
});

describe('describeLeaves', () => {
	it('reads the leaves out', () => {
		expect(describeLeaves({ firstNight: true, otherNight: false, reminders: 1, setup: true })).toBe(
			'wakes on the first night, 1 reminder token, changes setup'
		);
	});
});
