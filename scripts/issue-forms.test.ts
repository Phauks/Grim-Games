import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The issue forms in `.github/ISSUE_TEMPLATE/`, one per kind of report (listed on the chooser). */
const ISSUE_FORMS = {
	bug: 'bug_report.yml',
	enhancement: 'feature_request.yml',
	rules: 'rules_error.yml',
	data: 'data_problem.yml',
	question: 'question.yml'
} as const;

const dir = new URL('../.github/ISSUE_TEMPLATE/', import.meta.url);

describe('issue forms', () => {
	it('every form the app links to exists, and every form is linkable from the app', () => {
		const files = readdirSync(dir).filter((f) => f !== 'config.yml');
		expect(files.sort()).toEqual(Object.values(ISSUE_FORMS).sort());
	});

	it('the fields the app prefills exist in each form', () => {
		const ids = (file: string) =>
			[...readFileSync(new URL(file, dir), 'utf8').matchAll(/^\s+id: ([\w-]+)$/gm)].map(
				(m) => m[1]
			);
		expect(ids(ISSUE_FORMS.bug)).toEqual(
			expect.arrayContaining(['build', 'page', 'device', 'error'])
		);
		expect(ids(ISSUE_FORMS.rules)).toEqual(
			expect.arrayContaining(['character', 'wiki', 'build', 'page', 'device'])
		);
	});
});
