import type { BuildInfo } from '#lib/build-info.ts';

export const REPOSITORY_URL = 'https://github.com/Phauks/Grim-Games';

export function shortCommit(info: BuildInfo): string {
	return info.commit.slice(0, 7);
}

/** One line identifying the build, as shown at the end of the menu and pasted into reports. */
export function describeBuild(info: BuildInfo): string {
	return `v${info.version} · ${shortCommit(info)} · ${info.branch} · ${info.channel} · built ${info.builtAt}`;
}
