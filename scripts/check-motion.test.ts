import { describe, expect, it } from 'vitest';
import { motionProblems } from './check-motion.ts';

describe('check-motion', () => {
	it("flags a style or script that reads the device's Reduce motion itself", () => {
		const css = '.a {}\n@media (prefers-reduced-motion: reduce) {\n\t.a { animation: none; }\n}';
		expect(motionProblems('src/lib/ui/A.svelte', css)).toEqual([2]);
		const script = "import { prefersReducedMotion } from 'svelte/motion';";
		expect(motionProblems('src/lib/features/b.ts', script)).toEqual([1]);
	});

	it('passes the one setting and the styles that check its mark', () => {
		expect(
			motionProblems(
				'src/lib/ui/A.svelte',
				':global(:root[data-motion-off]) .a { animation: none; }'
			)
		).toEqual([]);
		expect(
			motionProblems(
				'src/lib/ui/animations.svelte.ts',
				"import { prefersReducedMotion } from 'svelte/motion';"
			)
		).toEqual([]);
	});
});
