/**
 * Lint: the two ways styles have let one thing cover another (Trevor, 2026-11-06: "their
 * biggest UI issues always with stuff being covered up").
 *
 * 1. A unitless `0` fallback in a calc that adds to or scales a length, such as
 *    `top: calc(-1 * var(--pinned-inset, 0))`. With the variable unset, the calc is a plain
 *    number, the whole declaration is dropped, and a pinned heading slides under what is
 *    above it. Write the fallback with a unit: `var(--pinned-inset, 0rem)`.
 * 2. A raw number for z-index. Each file picking its own 1, 2, 3 or 1000 is how a sheet ends up
 *    over a heading it should sit under. Use the layer tokens (`--z-*`, src/lib/ui/tokens/
 *    base.css). Files that still have raw values are in Z_INDEX_TODO with how many; the
 *    counts only shrink.
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

/** Raw z-index values per file, left from before this lint; each count may only go down. */
export const Z_INDEX_TODO: Record<string, number> = {
	'src/lib/features/about/UpdateBanner.svelte': 1,
	'src/lib/features/character-lab/LabPanel.svelte': 1,
	'src/lib/features/characters/CharacterRow.svelte': 2,
	'src/lib/features/day/DayPanel.svelte': 2,
	'src/lib/features/grimoire/BoardBackdrop.svelte': 2,
	'src/lib/features/grimoire/BoardCorner.svelte': 1,
	'src/lib/features/grimoire/BoardReminderChip.svelte': 2,
	'src/lib/features/grimoire/BoardRules.svelte': 2,
	'src/lib/features/grimoire/BoardSeats.svelte': 6,
	'src/lib/features/grimoire/GrimoireBoard.svelte': 3,
	'src/lib/features/grimoire/HistoryStrip.svelte': 1,
	'src/lib/features/grimoire/NightStrip.svelte': 3,
	'src/lib/features/grimoire/ReminderBank.svelte': 1,
	'src/lib/features/grimoire/ReminderCount.svelte': 1,
	'src/lib/features/grimoire/ReminderInHand.svelte': 1,
	'src/lib/features/grimoire/ReminderTethers.svelte': 1,
	'src/lib/features/grimoire/ReminderTray.svelte': 4,
	'src/lib/features/grimoire/SeatNameSuggestions.svelte': 1,
	'src/lib/features/grimoire/moving/MovingBackdrop.svelte': 1,
	'src/lib/features/info-tokens/ChainBar.svelte': 1,
	'src/lib/features/library/LibraryBrowser.svelte': 1,
	'src/lib/features/player/GenericGuessToken.svelte': 1,
	'src/lib/features/player/GuessMarks.svelte': 1,
	'src/lib/features/player/PlayerGrimTools.svelte': 1,
	'src/lib/features/player/PlayerReminderBin.svelte': 1,
	'src/lib/features/player/PlayerSeating.svelte': 4,
	'src/lib/features/scripts/ScriptDetails.svelte': 1,
	'src/lib/features/scripts/ScriptPicker.svelte': 1,
	'src/lib/features/settings/SettingsModal.svelte': 2,
	'src/lib/features/settings/sections/BoardPreview.svelte': 3,
	'src/lib/features/show/CharacterPicker.svelte': 2,
	'src/lib/features/show/CoverButton.svelte': 1,
	'src/lib/features/show/ShowToPlayer.svelte': 1,
	'src/lib/ui/base.css': 1,
	'src/lib/ui/layout/ContentsLayout.svelte': 1,
	'src/lib/ui/layout/FullScreenStage.svelte': 1,
	'src/lib/ui/primitives/Collapsible.svelte': 2,
	'src/lib/ui/primitives/FileView.svelte': 1,
	'src/lib/ui/settings/SettingGroup.svelte': 1,
	'src/lib/ui/table/DataTable.svelte': 6
};

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
	const rawZ = new Map<string, number>();
	for (const path of files(join(root, 'src'))) {
		const file = relative(root, path).split(sep).join('/');
		const source = readFileSync(path, 'utf8');
		const blocks = file.endsWith('.css') ? [{ css: source, firstLine: 1 }] : svelteStyles(source);
		const zLines: string[] = [];
		for (const { css, firstLine } of blocks) {
			for (const { line, problem } of findLayerProblems(css, firstLine)) {
				if (problem.startsWith('z-index')) {
					zLines.push(`${file}:${line}  ${problem}`);
					continue;
				}
				console.error(`${file}:${line}  ${problem}`);
				problems++;
			}
		}
		if (zLines.length) rawZ.set(file, zLines.length);
		if (zLines.length > (Z_INDEX_TODO[file] ?? 0)) {
			for (const z of zLines) console.error(z);
			problems += zLines.length - (Z_INDEX_TODO[file] ?? 0);
		}
	}
	for (const [file, allowed] of Object.entries(Z_INDEX_TODO)) {
		const now = rawZ.get(file) ?? 0;
		if (now < allowed) {
			console.error(`${file}: ${now} raw z-index value(s) left; lower Z_INDEX_TODO to ${now}`);
			problems++;
		}
	}
	if (problems) {
		console.error(`\n${problems} layer problem(s) in styles (scripts/check-layers.ts).`);
		process.exit(1);
	}
}
