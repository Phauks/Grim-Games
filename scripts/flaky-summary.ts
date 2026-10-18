/**
 * CI: lists the e2e tests that failed and then passed on their retry, so a flaky test shows
 * up in the job summary and as a warning instead of hiding behind a green check. Reads
 * Playwright's JSON report (playwright.config.ts writes it in CI). Tests are never skipped
 * for being flaky: the list is there to get them fixed.
 *
 * `node scripts/flaky-summary.ts --run [report.json]`; writes to $GITHUB_STEP_SUMMARY when set.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

type Spec = {
	title: string;
	file: string;
	line: number;
	tests: { projectName: string; status: string }[];
};
type Suite = { title?: string; specs?: Spec[]; suites?: Suite[] };

export type FlakyTest = { project: string; file: string; line: number; title: string };

/** The flaky tests in a Playwright JSON report, with the titles of their describe blocks. */
export function flakyTests(report: { suites?: Suite[] }): FlakyTest[] {
	const found: FlakyTest[] = [];
	const walk = (suite: Suite, titles: string[]) => {
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests) {
				if (test.status === 'flaky') {
					const title = [...titles, spec.title].join(' › ');
					found.push({ project: test.projectName, file: spec.file, line: spec.line, title });
				}
			}
		}
		for (const child of suite.suites ?? []) walk(child, [...titles, child.title ?? '']);
	};
	// Top-level suites are files; their titles are the file name, which `file` already carries.
	for (const file of report.suites ?? []) walk(file, []);
	return found;
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
		const flaky = flakyTests(JSON.parse(readFileSync(path, 'utf8')));
		for (const t of flaky) {
			console.log(
				`::warning file=e2e/${t.file},line=${t.line},title=Flaky test::[${t.project}] ${t.title}`
			);
		}
		const markdown = summaryMarkdown(flaky);
		if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
		else console.log(markdown);
	}
}
