/**
 * Lint: raw hex colours belong in theme palettes only (04-architecture.md §9). Everything
 * else uses semantic or component tokens. Run by `npm run lint`.
 *
 * Colour functions (`rgb()`, `color-mix()`, `oklch()`...) belong in the theme and token
 * files too: a screen that mixes its own 25% or 30% line ends up close to, but not the same
 * as, every other screen (Trevor, 2026-10-18: "the same, and not just similar, colors").
 * Add a token to src/lib/ui/tokens/components.css instead. A colour that must stay says
 * why in a `colour-ok: ...` comment on the same line.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scanned = ['src'];
// app.html's theme-color meta must be a literal colour (it is read before any CSS loads).
const allowed = ['src/lib/ui/themes/', 'src/lib/assets/', 'src/app.html'];
// Token files define the shared mixes; board backgrounds are pictures, not theme colours.
const mixesAllowed = [...allowed, 'src/lib/ui/tokens/', 'src/lib/features/grimoire/backgrounds.ts'];
const extensions = /\.(ts|js|svelte|css|html)$/;

// `#abc`, `#aabbcc`, `#aabbccdd` not followed by more word characters, so `#lib/...`,
// `{#each}` and `{#if}` never match.
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;

export function findHexColours(source: string): { line: number; match: string }[] {
	const found: { line: number; match: string }[] = [];
	source.split('\n').forEach((text, index) => {
		for (const match of text.matchAll(HEX)) found.push({ line: index + 1, match: match[0] });
	});
	return found;
}

const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi;

export function findColourFunctions(source: string): { line: number; match: string }[] {
	const found: { line: number; match: string }[] = [];
	source.split('\n').forEach((text, index) => {
		if (text.includes('colour-ok:')) return;
		for (const match of text.matchAll(COLOUR_FUNCTION)) {
			found.push({ line: index + 1, match: match[0].slice(0, -1) });
		}
	});
	return found;
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (extensions.test(entry.name)) yield path;
	}
}

if (process.argv.includes('--run')) {
	let problems = 0;
	for (const dir of scanned) {
		for (const path of files(join(root, dir))) {
			const file = relative(root, path).split(sep).join('/');
			if (allowed.some((prefix) => file.startsWith(prefix))) continue;
			const source = readFileSync(path, 'utf8');
			for (const { line, match } of findHexColours(source)) {
				console.error(`${file}:${line}  ${match}  use a theme token instead of a hex colour`);
				problems++;
			}
			// Tests hold colours as data (a parsed colour setting), not as styles.
			if (file.endsWith('.test.ts')) continue;
			if (mixesAllowed.some((prefix) => file.startsWith(prefix))) continue;
			for (const { line, match } of findColourFunctions(source)) {
				console.error(
					`${file}:${line}  ${match}()  use a token from src/lib/ui/tokens/components.css`
				);
				problems++;
			}
		}
	}
	if (problems) {
		console.error(`\n${problems} colour(s) outside the theme and token files.`);
		process.exit(1);
	}
}
