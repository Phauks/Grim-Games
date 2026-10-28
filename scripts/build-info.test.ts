import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readHistory, supersedingCommit } from '../build-info.ts';

// Trevor (2026-10-28): an update listed 0 changes, then the Changelog listed only one PR. A build
// of an older commit had deployed after a newer one, and its clone kept only its own commit.

const dirs: string[] = [];
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const run = (cwd: string, command: string) =>
	execSync(command, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
		.toString()
		.trim();

/** A repository with three merged PRs on `beta`, as GitHub would hold it. */
function upstream(): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'build-info-'));
	dirs.push(dir);
	run(dir, 'git init --quiet --initial-branch=beta');
	run(dir, 'git config user.email t@example.com && git config user.name T');
	run(dir, 'git config uploadpack.allowFilter true');
	for (const pr of [1, 2, 3])
		run(
			dir,
			`git commit --quiet --allow-empty -m "Merge pull request #${pr} from a/b" -m "Change ${pr}"`
		);
	return dir;
}

/** Workers Builds' clone: only the newest commit. */
function shallowClone(from: string): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'build-clone-'));
	dirs.push(dir);
	run(dir, `git clone --quiet --depth 1 --branch beta file://${from} .`);
	return dir;
}

describe('readHistory', () => {
	it('fetches the whole history on Workers Builds, so every PR is listed', () => {
		const origin = upstream();
		const cwd = shallowClone(origin);
		const history = readHistory({ WORKERS_CI: '1' }, 'beta', { cwd, remote: `file://${origin}` });
		expect(history.complete).toBe(true);
		expect(history.changes.map((c) => c.pr)).toEqual([3, 2, 1]);
	});

	it('falls back to the public repository when the clone has no usable origin', () => {
		const origin = upstream();
		const cwd = shallowClone(origin);
		run(cwd, 'git remote set-url origin file:///nowhere');
		const history = readHistory({ WORKERS_CI: '1' }, 'beta', { cwd, remote: `file://${origin}` });
		expect(history.complete).toBe(true);
		expect(history.changes).toHaveLength(3);
	});

	it('marks the history incomplete when nothing can be fetched', () => {
		const origin = upstream();
		const cwd = shallowClone(origin);
		run(cwd, 'git remote set-url origin file:///nowhere');
		const history = readHistory({ WORKERS_CI: '1' }, 'beta', { cwd, remote: 'file:///nowhere' });
		expect(history.complete).toBe(false);
		expect(history.changes.map((c) => c.pr)).toEqual([3]);
	});
});

describe('supersedingCommit', () => {
	const origin = upstream();
	const tip = run(origin, 'git rev-parse HEAD');
	const older = run(origin, 'git rev-parse HEAD~1');
	const remote = `file://${origin}`;

	it('names the newer commit when the branch has moved on since the build started', () => {
		expect(
			supersedingCommit({ WORKERS_CI: '1' }, { branch: 'beta', commit: older }, { remote })
		).toBe(tip);
	});

	it('lets the newest commit deploy', () => {
		expect(
			supersedingCommit({ WORKERS_CI: '1' }, { branch: 'beta', commit: tip }, { remote })
		).toBeNull();
	});

	it('never stops a build outside Workers Builds, on another branch, or offline', () => {
		expect(supersedingCommit({}, { branch: 'beta', commit: older }, { remote })).toBeNull();
		expect(
			supersedingCommit({ WORKERS_CI: '1' }, { branch: 'claude/x', commit: older }, { remote })
		).toBeNull();
		expect(
			supersedingCommit(
				{ WORKERS_CI: '1' },
				{ branch: 'beta', commit: older },
				{ remote: 'file:///nowhere' }
			)
		).toBeNull();
	});
});
