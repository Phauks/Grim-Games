/**
 * CI: lists the e2e tests that failed and then passed on their retry, so a flaky test shows
 * up in the job summary and as a warning instead of hiding behind a green check. Reads
 * Playwright's JSON report (playwright.config.ts writes it in CI). Tests are never skipped
 * for being flaky: the list is there to get them fixed.
 *
 * `node scripts/flaky-summary.ts --run [report.json]`; writes to $GITHUB_STEP_SUMMARY when set, and
 * sets the step output `flaky` to the count, so CI keeps the report of a run that only flaked.
 *
 * Each flaky or failed test also gets a notice with the page as it was when its first attempt
 * failed (Playwright's error context: the page's accessibility snapshot). Annotations are the
 * one part of a run that sessions can read through the API; traces and logs are not.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

type Spec = {
	title: string;
	file: string;
	line: number;
	tests: {
		projectName: string;
		status: string;
		results?: { status: string; attachments?: { name: string; path?: string }[] }[];
	}[];
};
type Suite = { title?: string; specs?: Spec[]; suites?: Suite[] };

export type FlakyTest = {
	project: string;
	file: string;
	line: number;
	title: string;
	/** The error context file of its first failed attempt, when Playwright wrote one. */
	errorContext?: string;
};

/** The first failed attempt's error context file. */
function errorContext(test: Spec['tests'][number]): string | undefined {
	const failed = test.results?.find((r) => r.status !== 'passed' && r.status !== 'skipped');
	return failed?.attachments?.find((a) => a.name === 'error-context' && a.path)?.path;
}

/**
 * The tests in a Playwright JSON report with one of the given statuses (`flaky` by default),
 * with the titles of their describe blocks.
 */
export function flakyTests(
	report: { suites?: Suite[] },
	statuses: readonly string[] = ['flaky']
): FlakyTest[] {
	const found: FlakyTest[] = [];
	const walk = (suite: Suite, titles: string[]) => {
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests) {
				if (statuses.includes(test.status)) {
					const title = [...titles, spec.title].join(' › ');
					const context = errorContext(test);
					found.push({
						project: test.projectName,
						file: spec.file,
						line: spec.line,
						title,
						...(context ? { errorContext: context } : {})
					});
				}
			}
		}
		for (const child of suite.suites ?? []) walk(child, [...titles, child.title ?? '']);
	};
	// Top-level suites are files; their titles are the file name, which `file` already carries.
	for (const file of report.suites ?? []) walk(file, []);
	return found;
}

/** The page snapshot of an error context file, without the error its other annotation shows. */
export function pageSnapshot(errorContext: string): string {
	const start = errorContext.indexOf('```yaml');
	return start < 0 ? errorContext : errorContext.slice(start);
}

/** Fits text into one workflow-command annotation: newlines encoded, cut to `max` characters. */
export function annotationText(text: string, max = 6000): string {
	const cut = text.length > max ? `${text.slice(0, max)}\n…` : text;
	return cut.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function summaryMarkdown(flaky: FlakyTest[]): string {
	if (!flaky.length) return '### Flaky e2e tests\n\nNone.\n';
	const rows = flaky.map((t) => `| ${t.project} | \`e2e/${t.file}:${t.line}\` | ${t.title} |`);
	return [
		`### Flaky e2e tests (${flaky.length})`,
		'',
		'Each failed once and passed on its retry. Fix the test or the code; never skip it.',
		'',
		'| Project | Test | Title |',
		'| --- | --- | --- |',
		...rows,
		''
	].join('\n');
}

if (process.argv.includes('--run')) {
	const path = process.argv.slice(2).find((arg) => arg !== '--run') ?? 'test-results/results.json';
	if (!existsSync(path)) {
		console.log(`No Playwright report at ${path}.`);
	} else {
		const report = JSON.parse(readFileSync(path, 'utf8'));
		const flaky = flakyTests(report);
		for (const t of flaky) {
			console.log(
				`::warning file=e2e/${t.file},line=${t.line},title=Flaky test::[${t.project}] ${t.title}`
			);
		}
		for (const t of flakyTests(report, ['flaky', 'unexpected'])) {
			if (!t.errorContext || !existsSync(t.errorContext)) continue;
			const page = annotationText(pageSnapshot(readFileSync(t.errorContext, 'utf8')));
			console.log(
				`::notice file=e2e/${t.file},line=${t.line},title=Page at failure::[${t.project}] ${t.title}%0A${page}`
			);
		}
		const markdown = summaryMarkdown(flaky);
		if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
		else console.log(markdown);
		if (process.env.GITHUB_OUTPUT)
			appendFileSync(process.env.GITHUB_OUTPUT, `flaky=${flaky.length}\n`);
	}
}
