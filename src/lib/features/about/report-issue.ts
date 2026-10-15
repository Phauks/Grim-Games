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

/**
 * Link to the bug-report form about one character's reference data (Character reference
 * page). Only public information goes in the query string: the character, its page
 * anchor, the build and the device.
 */
export function characterReportUrl(
	info: BuildInfo,
	character: { id: string; name: string },
	userAgent: string
): string {
	const params = new URLSearchParams({
		template: 'bug_report.yml',
		title: `[Reference] ${character.name} (${character.id}): `,
		build: describeBuild(info),
		page: `/reference#${character.id}`,
		device: userAgent
	});
	return `${REPOSITORY_URL}/issues/new?${params}`;
}
