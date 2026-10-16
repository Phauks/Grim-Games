import type { BuildInfo } from '#lib/build-info.ts';

export const REPOSITORY_URL = 'https://github.com/Phauks/Grim-Games';

export function shortCommit(info: BuildInfo): string {
	return info.commit.slice(0, 7);
}

/** One line identifying the build, as shown in the footer and pasted into reports. */
export function describeBuild(info: BuildInfo): string {
	return `v${info.version} · ${shortCommit(info)} · ${info.branch} · ${info.channel} · built ${info.builtAt}`;
}

/**
 * Link to the bug-report issue form with the build and page filled in. GitHub issue forms
 * accept query parameters named after field ids to prefill them
 * (docs.github.com, "Creating an issue from a URL query").
 */
export function bugReportUrl(info: BuildInfo, page: string, userAgent: string): string {
	const params = new URLSearchParams({
		template: 'bug_report.yml',
		build: describeBuild(info),
		page,
		device: userAgent
	});
	return `${REPOSITORY_URL}/issues/new?${params}`;
}

/** The issue forms in `.github/ISSUE_TEMPLATE/`, one per kind of report. */
export const ISSUE_FORMS = {
	bug: 'bug_report.yml',
	enhancement: 'feature_request.yml',
	rules: 'rules_error.yml',
	data: 'data_problem.yml',
	question: 'question.yml'
} as const;
export type IssueForm = keyof typeof ISSUE_FORMS;

/**
 * Link to one issue form with some fields filled in (keys are the form's field ids, plus
 * `title`). Only put public information in `fields`: it travels in the link.
 */
export function issueFormUrl(form: IssueForm, fields: Record<string, string>): string {
	const params = new URLSearchParams({ template: ISSUE_FORMS[form], ...fields });
	return `${REPOSITORY_URL}/issues/new?${params}`;
}

/**
 * Link to the Rules or character error form about one character (Character reference
 * page). Only public information goes in the query string: the character, its page
 * anchor, the build and the device.
 */
export function characterReportUrl(
	info: BuildInfo,
	character: { id: string; name: string },
	userAgent: string
): string {
	return issueFormUrl('rules', {
		title: `[Rules] ${character.name}: `,
		character: `${character.name} (${character.id})`,
		wiki: `https://wiki.bloodontheclocktower.com/${encodeURIComponent(character.name.replaceAll(' ', '_'))}`,
		build: describeBuild(info),
		page: `/reference#${character.id}`,
		device: userAgent
	});
}
