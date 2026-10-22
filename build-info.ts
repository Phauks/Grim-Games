import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { BuildInfo } from './src/lib/build-info.ts';
import { noteFor, type BuildCommit } from './src/lib/features/about/update-notes.ts';
import type { Change, ChangeHistory } from './src/lib/features/about/changelog.ts';
import { groupDirectCommits } from './src/lib/features/about/direct-commits.ts';

function git(args: string, timeout?: number): string {
	try {
		return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout })
			.toString()
			.trim();
	} catch {
		return '';
	}
}

/** The public repository, for fetching history when the build's clone has no usable remote. */
const REPOSITORY_GIT = 'https://github.com/Phauks/Grim-Games.git';

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

const isShallow = () => git('rev-parse --is-shallow-repository') === 'true';

/**
 * Fetches the rest of the history and the tags when the build's clone has only its newest
 * commit, as Workers Builds' does, so the Changelog can list every change. Only on Workers
 * Builds: CI and local builds don't need the full list. Leaves the clone as it was if GitHub
 * can't be reached.
 */
function fetchFullHistory(env: NodeJS.ProcessEnv, branch: string): void {
	if (!env.WORKERS_CI || !isShallow()) return;
	git('fetch --quiet --unshallow --tags origin', 120_000);
	if (isShallow()) git(`fetch --quiet --unshallow --tags ${REPOSITORY_GIT} ${branch}`, 120_000);
}

/** A release tag: `v` and a version, such as `v0.5.0`. */
const RELEASE_TAG = /^v\d/;

/**
 * Every change on the branch's own history, newest first, for the Changelog page
 * (src/lib/features/about/changelog.ts): each merged PR is one line with its title and the
 * day it merged; commits made straight on the branch count as one line a day. A change belongs to the oldest release tag (`v0.5.0`) that contains it;
 * changes in no tag are unreleased. `complete` is false when the clone's history stops short.
 */
export function readHistory(env: NodeJS.ProcessEnv = process.env, branch = 'HEAD'): ChangeHistory {
	fetchFullHistory(env, branch);
	const tags = git(`tag --list 'v*' --sort=creatordate`)
		.split('\n')
		.filter((tag) => RELEASE_TAG.test(tag))
		.map((tag) => ({ tag, commits: new Set(git(`rev-list ${tag}`).split('\n')) }));
	const changes = git('log --first-parent --format=%H%x1f%ct%x1f%B%x1e')
		.split('\x1e')
		.map((record) => record.trim())
		.filter(Boolean)
		.flatMap((record): Change[] => {
			const [sha, seconds = '', message = ''] = record.split('\x1f');
			const note = noteFor(sha, message);
			if (!note) return [];
			const release = tags.find((t) => t.commits.has(sha))?.tag.slice(1);
			return [
				{
					...note,
					date: new Date(Number(seconds) * 1000).toISOString().slice(0, 10),
					...(release ? { release } : {})
				}
			];
		});
	return { complete: !isShallow(), changes: groupDirectCommits(changes) };
}
