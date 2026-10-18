import { describe, expect, it } from 'vitest';
import { GAME_MODES } from '#lib/core/modes/index.ts';
import { aboutApproved, APPROVED_ABOUT } from './approved-about.ts';

describe('approved mode descriptions', () => {
	it('show only while the text is exactly what Trevor approved', () => {
		expect(aboutApproved('none', undefined)).toBe(false);
		for (const [id, text] of Object.entries(APPROVED_ABOUT)) {
			expect(aboutApproved(id, text)).toBe(true);
			expect(aboutApproved(id, `${text} `)).toBe(false);
		}
	});

	it('approve only built-in modes, each still matching its description', () => {
		const stale = Object.entries(APPROVED_ABOUT).filter(
			([id, text]) => GAME_MODES.find((m) => m.id === id)?.about !== text
		);
		expect(stale).toEqual([]);
	});
});
