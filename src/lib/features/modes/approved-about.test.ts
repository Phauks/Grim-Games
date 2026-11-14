import { describe, expect, it } from 'vitest';
import { GAME_MODES, SPECIAL_RULES, type SpecialRule } from '#lib/core/modes/index.ts';
import {
	aboutApproved,
	APPROVED_ABOUT,
	APPROVED_INSTRUCTIONS,
	instructionApproved,
	shownParts
} from './approved-about.ts';
import {
	INFINITE_NAMED,
	PLUS_ONE_NAMED,
	RULE_SWITCHES,
	SEAT_7_PROTECTOR,
	SEAT_7_WHISPER
} from './rule-switches.ts';

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

	it('may approve more than one text for a part, one per setting of its rule switch', () => {
		const key = 'plus-one:setup.information[0]';
		expect(instructionApproved(key, PLUS_ONE_NAMED)).toBe(true);
		expect(
			instructionApproved(key, 'Tell the table that one character from off the script is in play.')
		).toBe(true);
		expect(instructionApproved(key, `${PLUS_ONE_NAMED} `)).toBe(false);
		expect(instructionApproved('infinite-possibilities:setup.information[0]', INFINITE_NAMED)).toBe(
			true
		);
		// Seat 7's optional rules (approved 2026-11-13): the Grandmother Principle's line is last,
		// whichever of the others are on.
		expect(instructionApproved('seat-7:setup.seats', SEAT_7_WHISPER)).toBe(true);
		for (const i of [0, 1, 2])
			expect(instructionApproved(`seat-7:setup.ruleChanges[${i}]`, SEAT_7_PROTECTOR)).toBe(true);
	});

	it('approve only text a built-in mode or rule still has', () => {
		const builtIn = [...GAME_MODES, ...SPECIAL_RULES];
		const stale = Object.entries(APPROVED_INSTRUCTIONS).filter(([key, approved]) => {
			const [, id, part, index] = /^([^:]+):setup\.(\w+)(?:\[(\d+)\])?$/.exec(key) ?? [];
			const mode = builtIn.find((m) => m.id === id);
			// A rule with switches has a text for each setting of them, in every combination.
			const switches = mode ? (RULE_SWITCHES[mode.id] ?? []) : [];
			const versions = mode
				? Array.from({ length: 2 ** switches.length }, (_, bits) =>
						switches.reduce<SpecialRule>(
							(m, sw, i) => sw.apply(m, (bits & (1 << i)) !== 0),
							mode as SpecialRule
						)
					)
				: [];
			const texts = versions.map((m) => {
				const value: unknown = m.setup[part as never];
				const item = index === undefined ? value : (value as unknown[] | undefined)?.[+index];
				return (item as { instructions?: string } | undefined)?.instructions;
			});
			return [approved].flat().some((text) => !texts.includes(text));
		});
		expect(stale).toEqual([]);
	});
});
