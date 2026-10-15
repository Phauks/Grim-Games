import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findHexColours } from './check-colors.ts';
import { generatedFiles, missingIcons } from './generate-icons.ts';

describe('generate-icons', () => {
	it('every catalogue icon exists in @iconify-json/ph in every weight', () => {
		expect(missingIcons()).toEqual([]);
	});

	it('the committed icon modules match the catalogue (run `npm run icons`)', () => {
		for (const [name, content] of generatedFiles()) {
			const onDisk = readFileSync(
				new URL(`../src/lib/ui/icons/generated/${name}`, import.meta.url)
			);
			expect(onDisk.toString(), name).toBe(content);
		}
	});
});

describe('check-colors', () => {
	it('flags hex colours', () => {
		expect(findHexColours('a { color: #fff; }\nb { color: #A1B2C3aa }')).toEqual([
			{ line: 1, match: '#fff' },
			{ line: 2, match: '#A1B2C3aa' }
		]);
	});

	it('ignores import aliases and Svelte blocks', () => {
		expect(findHexColours("import x from '#lib/ui';\n{#each a as b}{#if c}{/if}{/each}")).toEqual(
			[]
		);
	});
});
