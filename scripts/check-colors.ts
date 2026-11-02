/**
 * Lint: raw hex colours belong in theme palettes only (04-architecture.md §9). Everything
 * else uses semantic or component tokens. Run by `npm run lint`.
 *
 * Colour functions (`rgb()`, `color-mix()`, `oklch()`...) belong in the theme and token
 * files too: a screen that mixes its own 25% or 30% line ends up close to, but not the same
 * as, every other screen (Trevor, 2026-10-18: "the same, and not just similar, colors").
 * Add a token to src/lib/ui/tokens/components.css instead. A colour that must stay says
 * why in a `colour-ok: ...` comment on the same line (or alone on the next, where Prettier
 * wraps it).
 *
 * Named colours (`white`, `black`, `gainsboro`...) count too, wherever a colour goes: a CSS
 * colour property, a custom property, an SVG `fill`/`stroke` attribute, an inline style or
 * a canvas `fillStyle`. Trevor (2026-10-23): every colour can be customised, or at least
 * follows the theme. `currentColor`, `transparent` and system colours (`Canvas`) are fine.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scanned = ['src'];
// app.html's theme-color meta must be a literal colour (it is read before any CSS loads).
const allowed = ['src/lib/ui/themes/', 'src/lib/assets/', 'src/app.html'];
// Token files define the shared mixes; board backgrounds (the moving ones' scenes too), seat
// frames and laurels are pictures, not theme colours.
const mixesAllowed = [
	...allowed,
	'src/lib/ui/tokens/',
	'src/lib/features/grimoire/backgrounds.ts',
	'src/lib/features/grimoire/scenes/',
	'src/lib/core/frames/frames.ts',
	'src/lib/core/achievements/laurel.ts'
];
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
	const lines = source.split('\n');
	lines.forEach((text, index) => {
		// Prettier can wrap a trailing comment onto the next line on its own; that still counts.
		const next = lines[index + 1]?.trim() ?? '';
		if (text.includes('colour-ok:') || (next.startsWith('/* colour-ok:') && next.includes('*/'))) {
			return;
		}
		for (const match of text.matchAll(COLOUR_FUNCTION)) {
			found.push({ line: index + 1, match: match[0].slice(0, -1) });
		}
	});
	return found;
}

const NAMED = (
	'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
	'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
	'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
	'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
	'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
	'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
	'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
	'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
	'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
	'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
	'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
	'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
	'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
	'palegoldenrod palegreen paleturquoise palevioletred papayawhip peru pink plum powderblue ' +
	'purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen ' +
	'seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue ' +
	'tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');
// Where a colour goes: CSS and custom properties, SVG attributes (`fill="..."`, also as
// object keys) and canvas styles.
const COLOUR_PLACE = String.raw`(?:--[\w-]+|color|background(?:-color|-image)?|fill|stroke|stop-color|flood-color|lighting-color|caret-color|accent-color|scrollbar-color|outline(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|box-shadow|text-shadow|text-decoration(?:-color)?|column-rule(?:-color)?|filter|mask(?:-image)?|-webkit-tap-highlight-color|-webkit-text-(?:stroke|fill)(?:-color)?|fillStyle|strokeStyle|shadowColor|stopColor|floodColor)`;
const NAMED_COLOUR = new RegExp(
	String.raw`(?<![\w-])${COLOUR_PLACE}['"]?\s*[:=]\s*[^;\n]*?(?<![\w-])(${NAMED.join('|')})(?![\w-])`,
	'g'
);

export function findNamedColours(source: string): { line: number; match: string }[] {
	const found: { line: number; match: string }[] = [];
	const lines = source.split('\n');
	lines.forEach((text, index) => {
		const next = lines[index + 1]?.trim() ?? '';
		if (text.includes('colour-ok:') || (next.startsWith('/* colour-ok:') && next.includes('*/'))) {
			return;
		}
		for (const match of text.matchAll(NAMED_COLOUR))
			found.push({ line: index + 1, match: match[1] });
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
			for (const { line, match } of findNamedColours(source)) {
				console.error(`${file}:${line}  ${match}  use a theme token instead of a named colour`);
				problems++;
			}
		}
	}
	if (problems) {
		console.error(`\n${problems} colour(s) outside the theme and token files.`);
		process.exit(1);
	}
}
