import { describe, expect, it } from 'vitest';
import { findLayerProblems } from './check-layers.ts';

describe('check-layers', () => {
	it('flags a unitless 0 fallback in a calc that scales or adds to a length', () => {
		// The pinned search header that slid under the app bar (ScriptDetails, 2026-11-06).
		expect(findLayerProblems('.a { top: calc(-1 * var(--pinned-inset, 0)); }')).toHaveLength(1);
		expect(findLayerProblems('.a { margin-top: calc(var(--x, 0) + 1rem); }')).toHaveLength(1);
		expect(findLayerProblems('.a { top: calc(var(--x, 0)); }')).toHaveLength(1);
	});

	it('leaves fallbacks with a unit, number properties and var-by-var products alone', () => {
		expect(findLayerProblems('.a { top: calc(-1 * var(--pinned-inset, 0rem)); }')).toEqual([]);
		expect(findLayerProblems('.a { z-index: calc(var(--z-overlay) + var(--layer, 0)); }')).toEqual(
			[]
		);
		expect(findLayerProblems('.a { opacity: calc(1 - var(--p, 0)); }')).toEqual([]);
		expect(findLayerProblems('.a { padding: calc(var(--depth, 0) * var(--space-3)); }')).toEqual(
			[]
		);
		expect(findLayerProblems('.a { transform: translateY(calc(var(--o, 0) * 100%)); }')).toEqual(
			[]
		);
		expect(findLayerProblems('.a { padding: 0 var(--x, 0); }')).toEqual([]);
	});

	it('flags a raw z-index and accepts the layer tokens', () => {
		expect(findLayerProblems('.a { z-index: 3; }')).toEqual([
			{ line: 1, problem: 'z-index: 3  use a --z-* layer token' }
		]);
		expect(findLayerProblems('.a { z-index: var(--z-raised); }')).toEqual([]);
		expect(findLayerProblems('.a { z-index: auto; }')).toEqual([]);
	});

	it('ignores comments', () => {
		expect(findLayerProblems('/* z-index: 3; top: calc(-1 * var(--x, 0)); */')).toEqual([]);
	});
});
