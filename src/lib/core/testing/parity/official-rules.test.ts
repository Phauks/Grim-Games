import { describe, expect, it } from 'vitest';
import * as real from '../../data/rules/index.ts';
import * as standIn from './official-rules.ts';

describe('the parity stand-in for the official rules files (M57)', () => {
	it('exports everything the real module does, so the parity run never meets a missing name', () => {
		const own = new Set(Object.keys(standIn));
		expect(Object.keys(real).filter((name) => !own.has(name))).toEqual([]);
	});

	it('has no official rules and no fallback to them', () => {
		expect(standIn.OFFICIAL_RULES.size).toBe(0);
		expect(standIn.rulesOf('imp')).toBeUndefined();
		expect(standIn.HIDDEN_OFFICIAL_RULES.get('imp')?.kills).toBeDefined();
	});
});
