/**
 * Lint: the two ways styles have let one thing cover another (Trevor, 2026-11-06: "their
 * biggest UI issues always with stuff being covered up").
 *
 * 1. A unitless `0` fallback in a calc that adds to or scales a length, such as
 *    `top: calc(-1 * var(--pinned-inset, 0))`. With the variable unset, the calc is a plain
 *    number, the whole declaration is dropped, and a pinned heading slides under what is
 *    above it. Write the fallback with a unit: `var(--pinned-inset, 0rem)`.
 * 2. A raw number for z-index. Each file picking its own 1, 2, 3 or 1000 is how a sheet ends up
 *    over a heading it should sit under. Use the named layers (`--z-*`, src/lib/ui/tokens/
 *    base.css), whose order is decided in one place.
 *
 * Scans .css files and Svelte <style> blocks under src. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelteStyles } from './check-px.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Properties that take plain numbers, where a unitless fallback is right. */
const NUMBER_PROPERTY =
	/^(?:z-index|opacity|order|flex-grow|flex-shrink|line-height|scale|font-weight|--[\w-]+)$/;

export type LayerProblem = { line: number; problem: string };

/** Problems in a stylesheet. `firstLine` is the line the CSS starts on in its file. */
export function findLayerProblems(css: string, firstLine = 1): LayerProblem[] {
	// Blank out comments (keeping newlines) so prose never matches.
	const code = css.replace(/\/\*[^]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
	const found: LayerProblem[] = [];
	const lineOf = (index: number) => firstLine + code.slice(0, index).split('\n').length - 1;
	let start = 0;
	for (let i = 0; i <= code.length; i++) {
		const char = code[i];
		if (i < code.length && char !== ';' && char !== '{' && char !== '}') continue;
		const chunk = code.slice(start, i);
		const chunkStart = start;
		start = i + 1;
		const trimmed = chunk.trim();
		if (char === '{' || trimmed.startsWith('@')) continue;
		const colon = trimmed.indexOf(':');
		if (colon === -1) continue;
		const property = trimmed.slice(0, colon).trim().toLowerCase();
		const value = trimmed.slice(colon + 1).trim();
		const at = chunkStart + chunk.indexOf(trimmed);

		if (property === 'z-index' && /^-?\d+$/.test(value.replace(/\s*!important$/, ''))) {
			found.push({ line: lineOf(at), problem: `z-index: ${value}  use a --z-* layer token` });
		}
		if (NUMBER_PROPERTY.test(property)) continue;
		for (const calc of chunk.matchAll(/calc\(/g)) {
			const body = calcBody(chunk, calc.index + calc[0].length);
			for (const fallback of body.matchAll(/var\(\s*(--[\w-]+)\s*,\s*0\s*\)/g)) {
				const before = body.slice(0, fallback.index);
				const after = body.slice(fallback.index + fallback[0].length);
				const added = /[+-]\s*$/.test(before) || /^\s*[+-]\s/.test(after);
				const scaledByNumber =
					/(?:^|[\s(])-?[\d.]+\s*\*\s*$/.test(before) ||
					/^\s*\*\s*-?[\d.]+\s*(?:$|[)+\-*/\s])/.test(after);
				const alone = before.trim() === '' && after.trim() === '';
				if (!added && !scaledByNumber && !alone) continue;
				found.push({
					line: lineOf(chunkStart + calc.index),
					problem: `${property}: var(${fallback[1]}, 0) in calc  write the fallback with a unit, such as 0rem`
				});
			}
		}
	}
	return found;
}

/** The text inside a calc( … ), from just after its opening bracket to its matching close. */
function calcBody(text: string, from: number): string {
	let depth = 1;
	for (let i = from; i < text.length; i++) {
		if (text[i] === '(') depth++;
		else if (text[i] === ')' && --depth === 0) return text.slice(from, i);
	}
	return text.slice(from);
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
	for (const path of files(join(root, 'src'))) {
		const file = relative(root, path).split(sep).join('/');
		const source = readFileSync(path, 'utf8');
		const blocks = file.endsWith('.css') ? [{ css: source, firstLine: 1 }] : svelteStyles(source);
		for (const { css, firstLine } of blocks) {
			for (const { line, problem } of findLayerProblems(css, firstLine)) {
				console.error(`${file}:${line}  ${problem}`);
				problems++;
			}
		}
	}
	if (problems) {
		console.error(`\n${problems} layer problem(s) in styles (scripts/check-layers.ts).`);
		process.exit(1);
	}
}
