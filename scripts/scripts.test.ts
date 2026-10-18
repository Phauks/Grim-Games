import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findColourFunctions, findHexColours } from './check-colors.ts';
import { findPxSizes, svelteStyles } from './check-px.ts';
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

	it('flags colour functions a screen mixes for itself', () => {
		const css =
			'a { border: 1px solid color-mix(in srgb, currentColor 30%, transparent); }\n' +
			'b { background: rgb(0 0 0 / 0.06); color: oklch(0.9 0 0); }';
		expect(findColourFunctions(css)).toEqual([
			{ line: 1, match: 'color-mix' },
			{ line: 2, match: 'rgb' },
			{ line: 2, match: 'oklch' }
		]);
	});

	it('lets a colour stay when its line says why', () => {
		expect(
			findColourFunctions('a { box-shadow: 0 0 1rem rgb(0 0 0); /* colour-ok: shade */ }')
		).toEqual([]);
		expect(findColourFunctions('a { background: var(--surface-hover); }')).toEqual([]);
	});
});

describe('check-px', () => {
	it('flags pixel sizes', () => {
		expect(findPxSizes('a {\n\twidth: 48px;\n\tpadding: 2px var(--u);\n}')).toEqual([
			{ line: 2, match: '48px', property: 'width' },
			{ line: 3, match: '2px', property: 'padding' }
		]);
	});

	it('allows hairlines, shadows, breakpoints, comments and px-ok lines', () => {
		const css = [
			'@media (max-width: 479.98px) {',
			'\ta { border: 2px solid; outline-offset: -3px; width: 1px; margin: 0px; }',
			'\tb { box-shadow: 0 6px 8px black; } /* a 44px hit area */',
			'\tc { --tap-target: 44px; /* px-ok: CSS pixels */ }',
			'}'
		].join('\n');
		expect(findPxSizes(css)).toEqual([]);
	});

	it('flags thick borders', () => {
		expect(findPxSizes('a { border-left: 6px solid; }')).toEqual([
			{ line: 1, match: '6px', property: 'border-left' }
		]);
	});

	it('finds Svelte style blocks with their starting line', () => {
		const blocks = svelteStyles('<p>40px</p>\n<style>\n\tp { width: 40px; }\n</style>');
		expect(blocks).toHaveLength(1);
		expect(findPxSizes(blocks[0].css, blocks[0].firstLine)).toEqual([
			{ line: 3, match: '40px', property: 'width' }
		]);
	});
});
