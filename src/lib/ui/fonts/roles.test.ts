import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES } from '#lib/ui/themes/registry.ts';
import {
	FONT_ROLE_INFO,
	FONT_ROLES,
	fontsFor,
	fontVariable,
	fontWeightVariable
} from './catalogue.ts';

const SRC = join(import.meta.dirname, '../../..');

/** Every Svelte component and stylesheet in `src`, as [path, text]. */
const files = (readdirSync(SRC, { recursive: true }) as string[])
	.filter((file) => /\.(svelte|css)$/.test(file))
	.map((file) => [relative(SRC, join(SRC, file)), readFileSync(join(SRC, file), 'utf8')] as const);

const roleVariables = FONT_ROLES.map(fontVariable);
const weightVariables = FONT_ROLES.filter((r) => FONT_ROLE_INFO[r].length === 'short').map(
	fontWeightVariable
);
/** Component font tokens (tokens/components.css); each one is built from a role variable. */
const fontTokens = ['--button-font', '--seat-font'];
const usesRole = (value: string) =>
	[...roleVariables, ...fontTokens].some((name) => value.includes(`var(${name})`));

/** The CSS of a file: a stylesheet, or a component's `<style>` blocks. */
const css = (path: string, text: string) =>
	path.endsWith('.css')
		? text
		: [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/** `font-family: x;`, `font: x;` and `--something-font: x;` declarations: [property, value]. */
function declarations(text: string): [string, string][] {
	return [...text.matchAll(/(?<![\w:-])(font-family|font|--[\w-]+-font)\s*:\s*([^;{}]+);/g)].map(
		(m) => [m[1], m[2].trim()]
	);
}

describe('font roles', () => {
	it('scans the components and stylesheets', () => {
		expect(files.length).toBeGreaterThan(20);
		expect(files.some(([path]) => path.endsWith('tokens/components.css'))).toBe(true);
	});

	it('no longer uses the old display and text font variables', () => {
		for (const [path, text] of files) {
			expect(text, path).not.toMatch(/--font-(display|text)\b/);
		}
	});

	it('sets every font through a role variable', () => {
		for (const [path, text] of files) {
			for (const [property, value] of declarations(css(path, text))) {
				if (value === 'inherit') continue;
				expect(usesRole(value), `${path}: ${property}: ${value}`).toBe(true);
			}
		}
	});

	it('refers only to role variables that exist', () => {
		const known = new Set([...roleVariables, ...weightVariables]);
		for (const [path, text] of files) {
			for (const [name] of text.matchAll(/--font-[\w-]+/g)) {
				expect(known.has(name as never), `${path}: ${name}`).toBe(true);
			}
		}
	});

	it('gives every role a label, a description and fonts to choose from', () => {
		for (const role of FONT_ROLES) {
			const info = FONT_ROLE_INFO[role];
			expect(info.label).toBeTruthy();
			expect(info.description).not.toMatch(/everything else/i);
			expect(fontsFor(role).length).toBeGreaterThan(1);
		}
	});

	it.each(THEMES.map((theme) => [theme.id, theme] as const))(
		'theme %s picks an offered font for every role',
		(_, theme) => {
			for (const role of FONT_ROLES) {
				expect(fontsFor(role).map((f) => f.id)).toContain(theme.fonts[role]);
			}
		}
	);
});
