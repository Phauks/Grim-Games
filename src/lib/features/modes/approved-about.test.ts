import { describe, expect, it } from 'vitest';
import { GAME_MODES, SPECIAL_RULES } from '#lib/core/modes/index.ts';
import {
	aboutApproved,
	APPROVED_ABOUT,
	APPROVED_INSTRUCTIONS,
	shownParts
} from './approved-about.ts';

describe('approved mode descriptions', () => {
	it('show only while the text is exactly what Trevor approved', () => {
		expect(aboutApproved('none', undefined)).toBe(false);
		for (const [id, text] of Object.entries(APPROVED_ABOUT)) {
			expect(aboutApproved(id, text)).toBe(true);
			expect(aboutApproved(id, `${text} `)).toBe(false);
		}
	});

	it('approve only built-in modes and rules, each still matching its description', () => {
		const builtIn = [...GAME_MODES, ...SPECIAL_RULES];
		const stale = Object.entries(APPROVED_ABOUT).filter(
			([id, text]) => builtIn.find((m) => m.id === id)?.about !== text
		);
		expect(stale).toEqual([]);
	});
});

describe('approved Storyteller instructions', () => {
	const bluffs = { kind: 'none', instructions: 'Don’t show the Demon any bluffs.' } as const;

	it('are left out of Inspect until approved, unless our own wording is on', () => {
		expect(shownParts('house', { bluffs }, false)).toEqual({ bluffs: { kind: 'none' } });
		expect(shownParts('house', { bluffs }, true)).toEqual({ bluffs });
		expect(
			shownParts('house', { information: [{ characters: [], instructions: 'x' }] }, false)
		).toEqual({ information: [{ characters: [] }] });
	});

	it('approve only text a built-in mode or rule still has', () => {
		const builtIn = [...GAME_MODES, ...SPECIAL_RULES];
		const stale = Object.entries(APPROVED_INSTRUCTIONS).filter(([key, text]) => {
			const [, id, part, index] = /^([^:]+):parts\.(\w+)(?:\[(\d+)\])?$/.exec(key) ?? [];
			const value: unknown = builtIn.find((m) => m.id === id)?.parts[part as never];
			const item = index === undefined ? value : (value as unknown[] | undefined)?.[+index];
			return (item as { instructions?: string } | undefined)?.instructions !== text;
		});
		expect(stale).toEqual([]);
	});
});
