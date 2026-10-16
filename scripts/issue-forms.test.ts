import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ISSUE_FORMS } from '../src/lib/features/about/report-issue.ts';

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
