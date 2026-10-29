/**
 * Lint: no source file over 800 lines (Trevor, 2026-10-23, the large-file review in the
 * project files, refactor/large-files.md). A big file is where threads' PRs collide, and logic
 * kept in a big component has no unit tests; split it into modules with a small surface
 * instead (`docs/shared-components.md` first, for a shared piece that already does the job).
 *
 * Counts every line of the .ts, .js, .svelte and .css files under src and worker. Tests,
 * rules data tables (`*.data.ts`, moving to `src/lib/core/data/rules/`), i18n catalogs and
 * generated files are not counted. LARGE_FILE_TODO lists the files that were over the limit
 * when the lint began; it only shrinks: a new file never goes on it, and a split takes its file
 * off. A listed file that is back under the limit (or gone) is only reported, not a failure, so
 * splits running in parallel never break each other's lint on beta. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_LINES = 800;

/** Over the limit before the lint; only shrinks. Each is split by its owner's thread. */
export const LARGE_FILE_TODO = [
	'src/lib/features/grimoire/GrimoireBoard.svelte',
	'src/lib/features/info-tokens/InfoTokenList.svelte',
	'src/lib/features/library/LibraryBrowser.svelte',
	'src/lib/ui/table/DataTable.svelte'
];

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

export type LineProblem = { file: string; lines: number; problem: 'too-long' | 'listed-short' };

/** Problems with the files' line counts, given the TODO list. */
export function lineProblems(
	sizes: ReadonlyMap<string, number>,
	todo: readonly string[] = LARGE_FILE_TODO
): LineProblem[] {
	const problems: LineProblem[] = [];
	for (const [file, lines] of sizes) {
		const listed = todo.includes(file);
		if (lines > MAX_LINES && !listed) problems.push({ file, lines, problem: 'too-long' });
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
	const missing = LARGE_FILE_TODO.filter((file) => !sizes.has(file));
	for (const { file, lines, problem } of problems) {
		if (problem === 'too-long') {
			console.error(`${file}: ${lines} lines, over ${MAX_LINES}. Split it into modules.`);
		} else {
			console.log(`${file}: ${lines} lines now; take it off LARGE_FILE_TODO.`);
		}
	}
	for (const file of missing) console.log(`${file}: gone; take it off LARGE_FILE_TODO.`);
	if (problems.some((p) => p.problem === 'too-long')) process.exit(1);
}
