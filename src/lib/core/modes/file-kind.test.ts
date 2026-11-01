/**
 * One format for game modes and special rules (Trevor, 2026-11-01: "One format,
 * auto-labelled"): a mode may set the rule parts, and the game plays them as it plays a rule's.
 */
import { describe, expect, it } from 'vitest';
import { combineRules } from './combine.ts';
import { modeRule } from './file-kind.ts';
import { STANDARD } from './registry.ts';
import type { GameMode, SpecialRule } from './types.ts';

const mode = (parts: GameMode['parts'], extra: Partial<GameMode> = {}): GameMode => ({
	format: 1,
	id: 'mine',
	name: 'Mine',
	sources: [],
	parts,
	...extra
});
const rule = (id: string, parts: SpecialRule['parts']): SpecialRule => ({
	kind: 'special-rule',
	format: 1,
	id,
	name: id,
	sources: [],
	parts
});

describe('a game mode that sets rule parts', () => {
	const wake = { kind: 'wake', when: 'each-night', dead: true } as const;
	const own = mode({
		assignment: { kind: 'bag' },
		text: ['The dead wake.'],
		nightSteps: [wake]
	});

	it('gives them to the screens that read a rules list, as a rule of its own', () => {
		expect(modeRule(own)).toEqual({
			kind: 'special-rule',
			format: 1,
			id: 'mine',
			name: 'Mine',
			sources: [],
			parts: { text: ['The dead wake.'], nightSteps: [wake] }
		});
		expect(modeRule(STANDARD)).toBe(undefined);
		expect(modeRule(mode({ assignment: { kind: 'bag' } }))).toBe(undefined);
	});

	it('folds them in with the rules chosen on top', () => {
		const other = { ...wake, when: 'one-night', night: 1 } as const;
		const { parts, conflicts } = combineRules(own, [rule('r', { nightSteps: [other] })]);
		expect(parts.nightSteps).toEqual([wake, other]);
		expect(parts.text).toEqual(['The dead wake.']);
		expect(conflicts).toEqual([]);
	});

	it('warns when the mode and a rule give one-answer parts different answers', () => {
		const seats = mode({ seats: { kind: 'storyteller-seat', count: 1, speaks: 'never' } });
		const { conflicts } = combineRules(seats, [
			rule('r', { seats: { kind: 'storyteller-seat', count: 2, speaks: 'never' } })
		]);
		expect(conflicts).toEqual([{ ids: ['mine', 'r'], part: 'seats' }]);
	});

	it('counts the whole-game parts as one-answer parts', () => {
		// Only a game mode sets them; a file read past the checker still warns, never mixes.
		const clash = { ...rule('r', {}), parts: { counts: { kind: 'standard' } } } as SpecialRule;
		const { parts, conflicts } = combineRules(
			mode({ counts: { kind: 'per-town', maxDifference: 1 } }),
			[clash]
		);
		expect(parts.counts).toEqual({ kind: 'per-town', maxDifference: 1 });
		expect(conflicts).toEqual([{ ids: ['mine', 'r'], part: 'counts' }]);
	});

	it('reads the conflicts a mode lists, as a rule’s', () => {
		const { conflicts } = combineRules(mode({}, { conflictsWith: { rules: ['r'] } }), [
			rule('r', {})
		]);
		expect(conflicts).toEqual([{ ids: ['mine', 'r'] }]);
	});
});
