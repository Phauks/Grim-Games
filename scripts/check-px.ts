/**
 * Lint: no fixed pixel sizes in styles (Trevor, 2026-10-16). Sizes are relative so the app
 * follows the browser's font size: `var(--u)` and the spacing/radius tokens for layout,
 * rem/em for text, %, viewport or container units for anything that fills space.
 * `N px` is `calc(N / 16 * var(--u))` at the default size, so conversions look identical.
 *
 * Allowed: 0px and 1px anywhere (hairlines, visually-hidden boxes, a pressed nudge), up to
 * 4px in border, outline and text-decoration widths (lines, not element sizes), any px in
 * box-shadow and text-shadow, and media or container query conditions. Anything else that
 * must be a device pixel says why on the same line: a comment containing `px-ok:`.
 *
 * Scans .css files and Svelte <style> blocks under src. Pixel values computed in script
 * (style:--size="{size}px", often measured from the board) are not failures; `--verbose`
 * lists them. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PX = /(-?\d*\.?\d+)px\b/g;
const LINE_PROPERTY = /^(?:border|outline|text-decoration|text-underline-offset|column-rule)/;
const SHADOW_PROPERTY = /^(?:box-shadow|text-shadow)$/;

export type PxProblem = { line: number; match: string; property: string };

/** Problems in a stylesheet. `firstLine` is the line the CSS starts on in its file. */
export function findPxSizes(css: string, firstLine = 1): PxProblem[] {
	const lines = css.split('\n');
	const okLines = new Set<number>();
	lines.forEach((text, index) => {
		if (/\/\*[^]*?px-ok:/.test(text)) okLines.add(index);
	});
	// Blank out comments (keeping newlines) so prose like "a 44px hit area" never matches.
	const code = css.replace(/\/\*[^]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

	const found: PxProblem[] = [];
	let start = 0;
	for (let i = 0; i <= code.length; i++) {
		const char = code[i];
		if (i < code.length && char !== ';' && char !== '{' && char !== '}') continue;
		const chunk = code.slice(start, i);
		const chunkStart = start;
		start = i + 1;
		const trimmed = chunk.trim();
		// Selectors and at-rule preludes (media query breakpoints) are not sizes.
		if (char === '{' || trimmed.startsWith('@')) continue;
		const colon = trimmed.indexOf(':');
		if (colon === -1) continue;
		const property = trimmed.slice(0, colon).trim().toLowerCase();
		for (const match of chunk.matchAll(PX)) {
			const value = Math.abs(Number(match[1]));
			if (value <= 1) continue;
			if (SHADOW_PROPERTY.test(property)) continue;
			if (LINE_PROPERTY.test(property) && value <= 4) continue;
			const lineIndex = code.slice(0, chunkStart + match.index).split('\n').length - 1;
			if (okLines.has(lineIndex)) continue;
			found.push({ line: firstLine + lineIndex, match: match[0], property });
		}
	}
	return found;
}

/** The CSS inside a Svelte file's <style> blocks, each with the line it starts on. */
export function svelteStyles(source: string): { css: string; firstLine: number }[] {
	const blocks: { css: string; firstLine: number }[] = [];
	for (const match of source.matchAll(/(<style[^>]*>)([^]*?)<\/style>/g)) {
		const offset = match.index + match[1].length;
		blocks.push({ css: match[2], firstLine: source.slice(0, offset).split('\n').length });
	}
	return blocks;
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(css|svelte)$/.test(entry.name)) yield path;
	}
}

if (process.argv.includes('--run')) {
	let problems = 0;
	const notes: string[] = [];
	for (const path of files(join(root, 'src'))) {
		const file = relative(root, path).split(sep).join('/');
		const source = readFileSync(path, 'utf8');
		const blocks = file.endsWith('.css') ? [{ css: source, firstLine: 1 }] : svelteStyles(source);
		for (const { css, firstLine } of blocks) {
			for (const { line, match, property } of findPxSizes(css, firstLine)) {
				console.error(`${file}:${line}  ${property}: ${match}  use var(--u), a token, rem/em or %`);
				problems++;
			}
		}
		if (file.endsWith('.svelte')) {
			source.split('\n').forEach((text, index) => {
				if (/style:[\w-]+="[^"]*\}px/.test(text)) notes.push(`${file}:${index + 1}`);
			});
		}
	}
	if (notes.length && process.argv.includes('--verbose')) {
		console.log(`Pixel sizes computed in script (not failures):\n  ${notes.join('\n  ')}`);
	}
	if (problems) {
		console.error(`\n${problems} fixed pixel size(s) in styles.`);
		process.exit(1);
	}
}
