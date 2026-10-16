import { describe, expect, it } from 'vitest';
import { contrastRatio, resolveToken } from '#lib/ui/themes/contrast.ts';
import { THEMES } from '#lib/ui/themes/registry.ts';

// Badge text must read on its team colour. A Traveller badge with no alignment is half good,
// half evil under one text colour (--on-good), so that colour must read on both halves.
describe('badge colours', () => {
	for (const theme of THEMES) {
		it(`${theme.id}: badge text reads on good, evil and the Traveller split`, () => {
			const table = { ...theme.palette, ...theme.tokens };
			const colour = (name: string) => resolveToken(name, table);
			expect(contrastRatio(colour('--on-good'), colour('--good'))).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colour('--on-evil'), colour('--evil'))).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colour('--on-good'), colour('--evil'))).toBeGreaterThanOrEqual(4.5);
		});
	}
});
