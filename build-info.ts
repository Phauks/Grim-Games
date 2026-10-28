import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { BuildInfo } from './src/lib/build-info.ts';
import { noteFor, type BuildCommit } from './src/lib/features/about/update-notes.ts';
import type { Change, ChangeHistory } from './src/lib/features/about/changelog.ts';
import { groupDirectCommits } from './src/lib/features/about/direct-commits.ts';

function git(args: string, timeout?: number, cwd?: string): string {
	try {
		return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout, cwd })
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

const isShallow = (cwd?: string) =>
	git('rev-parse --is-shallow-repository', undefined, cwd) === 'true';

/**
 * Fetches the rest of the history and the tags when the build's clone has only its newest
 * commit, as Workers Builds' does, so the Changelog can list every change. Only on Workers
 * Builds: CI and local builds don't need the full list. Leaves the clone as it was if GitHub
 * can't be reached.
 *
 * Commits only (`--filter=tree:0`, git-scm.com/docs/partial-clone): the history needs messages
 * and dates, not files, and that is a fraction of the download. A build whose fetch failed
 * listed one change and deployed minutes late, after newer builds (Trevor, 2026-10-28), so each
 * source is tried twice, then once more for everything should the server refuse the filter.
 */
export function fetchFullHistory(
	env: NodeJS.ProcessEnv,
	branch: string,
	{ remote = REPOSITORY_GIT, cwd }: { remote?: string; cwd?: string } = {}
): boolean {
	if (!env.WORKERS_CI || !isShallow(cwd)) return true;
	const tries = [
		'--filter=tree:0 origin',
		'--filter=tree:0 origin',
		`--filter=tree:0 ${remote} ${branch}`,
		`--filter=tree:0 ${remote} ${branch}`,
		`${remote} ${branch}`
	];
	for (const from of tries) {
		git(`fetch --quiet --unshallow --tags ${from}`, 60_000, cwd);
		if (!isShallow(cwd)) return true;
	}
	console.warn('build-info: could not fetch the history, so the Changelog lists only this build');
	return false;
}

/** A release tag: `v` and a version, such as `v0.5.0`. */
const RELEASE_TAG = /^v\d/;

/**
 * Every change on the branch's own history, newest first, for the Changelog page
 * (src/lib/features/about/changelog.ts): each merged PR is one line with its title and the
 * day it merged; commits made straight on the branch count as one line a day. A change belongs to the oldest release tag (`v0.5.0`) that contains it;
 * changes in no tag are unreleased. `complete` is false when the clone's history stops short.
 */
export function readHistory(
	env: NodeJS.ProcessEnv = process.env,
	branch = 'HEAD',
	options: { remote?: string; cwd?: string } = {}
): ChangeHistory {
	const { cwd } = options;
	fetchFullHistory(env, branch, options);
	const tags = git(`tag --list 'v*' --sort=creatordate`, undefined, cwd)
		.split('\n')
		.filter((tag) => RELEASE_TAG.test(tag))
		.map((tag) => ({
			tag,
			commits: new Set(git(`rev-list ${tag}`, undefined, cwd).split('\n'))
		}));
	const changes = git('log --first-parent --format=%H%x1f%ct%x1f%B%x1e', undefined, cwd)
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
	return { complete: !isShallow(cwd), changes: groupDirectCommits(changes) };
}

/** The branches Workers Builds deploys (README): `main` to production, `beta` to its Preview. */
const DEPLOYED_BRANCHES = ['main', 'beta'];

/**
 * The commit a deployed branch has moved on to since this build started, or null. Workers
 * Builds can run builds side by side and deploys each as it finishes, so a slow build of an older
 * commit could replace a newer one: phones were then offered an "update" with no changes, onto
 * an older build (Trevor, 2026-10-28). Such a build stops before its deploy; the newer
 * commit's own build deploys. Null too when GitHub can't be reached, so a deploy is never lost
 * to a network fault.
 */
export function supersedingCommit(
	env: NodeJS.ProcessEnv,
	info: Pick<BuildInfo, 'branch' | 'commit'>,
	{ remote = REPOSITORY_GIT, cwd }: { remote?: string; cwd?: string } = {}
): string | null {
	if (!env.WORKERS_CI || !DEPLOYED_BRANCHES.includes(info.branch)) return null;
	const tip = git(`ls-remote ${remote} refs/heads/${info.branch}`, 30_000, cwd).split(/\s/)[0];
	return /^[0-9a-f]{40}$/.test(tip) && tip !== info.commit ? tip : null;
}
