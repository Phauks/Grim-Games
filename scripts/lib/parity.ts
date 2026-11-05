/**
 * The parity gate's bookkeeping (M57): which rules tests fail when every official character is
 * played as a custom one, against the shrink-only list in src/lib/core/testing/parity/todo.json.
 */

/** One test result from Vitest's JSON reporter. */
export interface ParityResult {
	/** The test file, relative to the repository. */
	file: string;
	/** The describe blocks and the test's own name, joined by spaces as Vitest does. */
	name: string;
	status: 'passed' | 'failed' | 'skipped' | 'todo' | 'pending';
}

/** A file that failed to load has no tests; it counts as one failure under this name. */
export const FILE_FAILED = '(file failed to load)';

/**
 * Data checks pin TPI's data (edition, night sheet, reminders), which a custom character
 * doesn't have by design, so they are not behaviour and never count.
 */
const DATA_BLOCK = 'data (roles.json)';

export const parityKey = (r: Pick<ParityResult, 'file' | 'name'>): string =>
	`${r.file} > ${r.name}`;

/** The behaviour tests that fail in the parity run, as list keys, sorted. */
export function parityFailures(results: readonly ParityResult[]): string[] {
	return results
		.filter((r) => r.status === 'failed' && !r.name.includes(DATA_BLOCK))
		.map(parityKey)
		.sort();
}

export interface ParityReport {
	/** Failing, and not on the list: a regression, or a new test that needs the engine. */
	added: string[];
	/** On the list, and passing now: take them off. */
	fixed: string[];
	failing: number;
	listed: number;
}

export function compareParity(failures: readonly string[], todo: readonly string[]): ParityReport {
	const listed = new Set(todo);
	const failing = new Set(failures);
	return {
		added: failures.filter((f) => !listed.has(f)),
		fixed: todo.filter((t) => !failing.has(t)),
		failing: failing.size,
		listed: listed.size
	};
}

/** Reads Vitest's JSON report into results with repository-relative file names. */
export function readVitestJson(report: unknown, root: string): ParityResult[] {
	const out: ParityResult[] = [];
	const files = (report as { testResults?: unknown[] }).testResults ?? [];
	for (const raw of files) {
		const file = raw as {
			name: string;
			status: string;
			assertionResults: { fullName: string; status: ParityResult['status'] }[];
		};
		const rel = file.name.startsWith(root) ? file.name.slice(root.length + 1) : file.name;
		if (file.assertionResults.length === 0 && file.status === 'failed')
			out.push({ file: rel, name: FILE_FAILED, status: 'failed' });
		for (const a of file.assertionResults)
			out.push({ file: rel, name: a.fullName, status: a.status });
	}
	return out;
}
