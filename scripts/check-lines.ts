/**
 * Lint: no source file over 800 lines (Trevor, 2026-10-23, the large-file review in the
 * project files, refactor/large-files.md). A big file is where threads' PRs collide, and logic
 * kept in a big component has no unit tests; split it into modules with a small surface
 * instead (`docs/shared-components.md` first, for a shared piece that already does the job).
 *
 * Counts every line of the .ts, .js, .svelte and .css files under src and worker. Tests,
 * rules data tables (`*.data.ts`, moving to `src/lib/core/data/rules/`), i18n catalogs and
 * generated files are not counted. LARGE_FILES lists the files kept over the limit on
 * purpose (Trevor, 2026-10-29: split until it gets silly, then name the exception), each with
 * why and a cap it may not grow past. The list only shrinks: a new file never goes on it, a
 * cap is never raised to fit a change (split the file instead), and a split under the limit
 * takes its file off. A listed file that is back under the limit (or gone) is only reported,
 * not a failure, so splits running in parallel never break each other's lint on beta. Run by
 * `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_LINES = 800;

/** A file kept over the limit: why, and the most lines it may have. */
export interface LargeFile {
	cap: number;
	why: string;
}

/** Kept over the limit on purpose; only shrinks, and no cap goes up. */
export const LARGE_FILES: Readonly<Record<string, LargeFile>> = {
	'src/lib/features/grimoire/GrimoireBoard.svelte': {
		cap: 1300,
		why: 'The board wires the dialogs and sheets over it; its pieces are already split out.'
	},
	'src/lib/ui/table/DataTable.svelte': {
		cap: 1050,
		why: 'Its narrow-mode styles are keyed on the root, so the template stays whole.'
	}
};

/** Whether the lint counts a file (a path relative to the repository, with `/`). */
export function counted(file: string): boolean {
	if (!/\.(ts|js|svelte|css)$/.test(file)) return false;
	if (/\.(test|e2e)\.ts$/.test(file) || file.endsWith('.data.ts') || file.endsWith('.d.ts')) {
		return false;
	}
	return !file.includes('/i18n/messages/') && !file.includes('/generated/');
}

/** Lines in a file's text, as `wc -l` counts them for a file ending in a newline. */
export function lineCount(source: string): number {
	if (source === '') return 0;
	return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
}

export type LineProblem = {
	file: string;
	lines: number;
	problem: 'too-long' | 'over-cap' | 'listed-short';
};

/** Problems with the files' line counts, given the files kept over the limit. */
export function lineProblems(
	sizes: ReadonlyMap<string, number>,
	large: Readonly<Record<string, LargeFile>> = LARGE_FILES
): LineProblem[] {
	const problems: LineProblem[] = [];
	for (const [file, lines] of sizes) {
		const listed = large[file];
		if (lines > MAX_LINES && !listed) problems.push({ file, lines, problem: 'too-long' });
		if (listed && lines > listed.cap) problems.push({ file, lines, problem: 'over-cap' });
		if (lines <= MAX_LINES && listed) problems.push({ file, lines, problem: 'listed-short' });
	}
	return problems;
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else yield path;
	}
}

if (process.argv.includes('--run')) {
	const root = fileURLToPath(new URL('..', import.meta.url));
	const sizes = new Map<string, number>();
	for (const dir of ['src', 'worker']) {
		for (const path of files(join(root, dir))) {
			const file = relative(root, path).split(sep).join('/');
			if (counted(file)) sizes.set(file, lineCount(readFileSync(path, 'utf8')));
		}
	}
	const problems = lineProblems(sizes);
	const missing = Object.keys(LARGE_FILES).filter((file) => !sizes.has(file));
	for (const { file, lines, problem } of problems) {
		if (problem === 'too-long') {
			console.error(`${file}: ${lines} lines, over ${MAX_LINES}. Split it into modules.`);
		} else if (problem === 'over-cap') {
			const cap = LARGE_FILES[file].cap;
			console.error(`${file}: ${lines} lines, over its cap of ${cap}. Split a piece out.`);
		} else {
			console.log(`${file}: ${lines} lines now; take it off LARGE_FILES.`);
		}
	}
	for (const file of missing) console.log(`${file}: gone; take it off LARGE_FILES.`);
	if (problems.some((p) => p.problem !== 'listed-short')) process.exit(1);
}
