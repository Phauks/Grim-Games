import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { BuildInfo } from './src/lib/build-info.ts';
import { noteFor, type BuildCommit } from './src/lib/features/about/update-notes.ts';

function git(args: string): string {
	try {
		return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return '';
	}
}

/**
 * Reads build metadata at build time. Workers Builds sets WORKERS_CI_COMMIT_SHA and
 * WORKERS_CI_BRANCH (developers.cloudflare.com/workers/ci-cd/builds/configuration);
 * GitHub Actions sets GITHUB_SHA and GITHUB_HEAD_REF/GITHUB_REF_NAME; otherwise ask git.
 */
export function readBuildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
	const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
	const commit = env.WORKERS_CI_COMMIT_SHA || env.GITHUB_SHA || git('rev-parse HEAD') || 'unknown';
	const branch =
		env.WORKERS_CI_BRANCH ||
		env.GITHUB_HEAD_REF ||
		env.GITHUB_REF_NAME ||
		git('rev-parse --abbrev-ref HEAD') ||
		'unknown';
	const channel = env.WORKERS_CI ? (branch === 'main' ? 'production' : 'preview') : 'local';
	return { version: pkg.version, commit, branch, builtAt: new Date().toISOString(), channel };
}

/** How many recent commits each build lists in `/build-notes.json` for the update prompt. */
const NOTE_COMMITS = 100;

/**
 * Recent changes, newest first, for the update prompt's "What changed" list
 * (src/lib/features/about/update-notes.ts): the branch's own history (`--first-parent`), so
 * each merged PR is one line with its title. Empty when git history is unavailable.
 */
export function readCommits(limit = NOTE_COMMITS): BuildCommit[] {
	return git(`log --first-parent -n ${limit} --format=%H%x1f%B%x1e`)
		.split('\x1e')
		.map((record) => record.trim())
		.filter(Boolean)
		.flatMap((record) => {
			const [sha, message = ''] = record.split('\x1f');
			return noteFor(sha, message) ?? [];
		});
}
