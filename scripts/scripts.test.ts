import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findColourFunctions, findHexColours, findNamedColours } from './check-colors.ts';
import { counted, lineCount, lineProblems, MAX_LINES } from './check-lines.ts';
import { findPxSizes, svelteStyles } from './check-px.ts';
import { flakyTests, summaryMarkdown } from './flaky-summary.ts';
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

	it('takes the reason from the next line when Prettier wraps it there', () => {
		const css =
			'a { background: linear-gradient(\n\trgb(0 0 0) 75%\n\t/* colour-ok: shade */,\n\trgb(0 0 0)\n); }';
		expect(findColourFunctions(css)).toEqual([{ line: 4, match: 'rgb' }]);
	});

	it('flags named colours wherever a colour goes', () => {
		const source = [
			'a { background: white; border: 1px solid var(--x, gainsboro); }',
			'<circle fill="black" style="color: red" />',
			"ctx.fillStyle = 'navy';",
			'b { --paper: ivory; }'
		].join('\n');
		expect(findNamedColours(source)).toEqual([
			{ line: 1, match: 'white' },
			{ line: 1, match: 'gainsboro' },
			{ line: 2, match: 'black' },
			{ line: 2, match: 'red' },
			{ line: 3, match: 'navy' },
			{ line: 4, match: 'ivory' }
		]);
	});

	it('leaves words, keywords and tokens that only look like colours', () => {
		const source = [
			'a { color: currentColor; background: transparent; fill: none; }',
			'b { --scratch-white-ink: var(--on-reminder); background: var(--surface, Canvas); }',
			"const label = 'Green felt'; const team = 'red';",
			'c { color: white; } /* colour-ok: a reason */'
		].join('\n');
		expect(findNamedColours(source)).toEqual([]);
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

describe('flaky-summary', () => {
	const report = {
		suites: [
			{
				title: 'room.e2e.ts',
				specs: [
					{
						title: 'a phone joins',
						file: 'room.e2e.ts',
						line: 17,
						tests: [
							{ projectName: 'phone', status: 'flaky' },
							{ projectName: 'tablet', status: 'expected' }
						]
					}
				],
				suites: [
					{
						title: 'no sideways scrolling',
						specs: [
							{
								title: '320px',
								file: 'room.e2e.ts',
								line: 80,
								tests: [{ projectName: 'tablet', status: 'flaky' }]
							}
						]
					}
				]
			}
		]
	};

	it('lists only tests that passed on a retry, with their describe titles', () => {
		expect(flakyTests(report)).toEqual([
			{ project: 'phone', file: 'room.e2e.ts', line: 17, title: 'a phone joins' },
			{ project: 'tablet', file: 'room.e2e.ts', line: 80, title: 'no sideways scrolling › 320px' }
		]);
	});

	it('says None when nothing was flaky', () => {
		expect(summaryMarkdown([])).toContain('None.');
		expect(summaryMarkdown(flakyTests(report))).toContain(
			'| phone | `e2e/room.e2e.ts:17` | a phone joins |'
		);
	});
});

describe('CI Playwright image', () => {
	it('matches the installed @playwright/test, so its baked-in Chromium is the one tests expect', () => {
		const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
		const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
		const installed = lock.packages['node_modules/@playwright/test'].version;
		const tags = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
		expect(tags.length).toBeGreaterThan(0);
		for (const tag of tags) expect(tag, 'update the image tags in ci.yml').toBe(installed);
	});
});

describe('check-lines', () => {
	it('counts lines as wc -l does', () => {
		expect(lineCount('')).toBe(0);
		expect(lineCount('a\nb\n')).toBe(2);
		expect(lineCount('a\nb')).toBe(2);
	});

	it('skips tests, rules data tables, catalogs and generated files', () => {
		expect(counted('src/lib/features/grimoire/board.ts')).toBe(true);
		expect(counted('src/lib/ui/table/DataTable.svelte')).toBe(true);
		expect(counted('src/lib/features/grimoire/board.test.ts')).toBe(false);
		expect(counted('e2e/board.e2e.ts')).toBe(false);
		expect(counted('src/lib/core/rules/reminder-placeholders.data.ts')).toBe(false);
		expect(counted('src/lib/i18n/messages/en/room.ts')).toBe(false);
		expect(counted('src/lib/ui/icons/generated/ph-regular.ts')).toBe(false);
		expect(counted('src/lib/core/data/rules/fool.json')).toBe(false);
	});

	it('flags a long file unless listed, and a listed file once it is short', () => {
		const sizes = new Map([
			['src/new.ts', MAX_LINES + 1],
			['src/listed.ts', MAX_LINES + 1],
			['src/split.ts', MAX_LINES],
			['src/fine.ts', 10]
		]);
		expect(lineProblems(sizes, ['src/listed.ts', 'src/split.ts'])).toEqual([
			{ file: 'src/new.ts', lines: MAX_LINES + 1, problem: 'too-long' },
			{ file: 'src/split.ts', lines: MAX_LINES, problem: 'listed-short' }
		]);
	});
});
