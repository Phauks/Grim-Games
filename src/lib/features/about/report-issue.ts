import type { BuildInfo } from '#lib/build-info.ts';

export const REPOSITORY_URL = 'https://github.com/Phauks/Grim-Games';

export function shortCommit(info: BuildInfo): string {
	return info.commit.slice(0, 7);
}

/** One line identifying the build, as shown in the footer and pasted into reports. */
export function describeBuild(info: BuildInfo): string {
	return `v${info.version} · ${shortCommit(info)} · ${info.branch} · ${info.channel} · built ${info.builtAt}`;
}

/** The issue forms in `.github/ISSUE_TEMPLATE/`, one per kind of report (listed on the chooser). */
export const ISSUE_FORMS = {
	bug: 'bug_report.yml',
	enhancement: 'feature_request.yml',
	rules: 'rules_error.yml',
	data: 'data_problem.yml',
	question: 'question.yml'
} as const;
