/**
 * Helpers shared by the data-sync scripts: a shallow, sparse git checkout of a public
 * GitHub repository, stable JSON output, and hashing.
 *
 * Git is used instead of per-file HTTP downloads because one checkout gives a consistent
 * snapshot at a single commit, needs no GitHub API token (the API is rate-limited), and
 * works behind the same proxies git already handles.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SyncError';
	}
}

export function git(args: string[], cwd: string | undefined, timeoutMs: number): string {
	const result = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		timeout: timeoutMs,
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
	});
	const command = `git ${args.join(' ')}`;
	if (result.error) {
		const timedOut = (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
		throw new SyncError(
			timedOut
				? `${command} timed out after ${timeoutMs / 1000}s`
				: `${command} failed: ${result.error.message}`
		);
	}
	if (result.signal) throw new SyncError(`${command} was killed (${result.signal})`);
	if (result.status !== 0) {
		throw new SyncError(`${command} exited with ${result.status}:\n${result.stderr.trim()}`);
	}
	return result.stdout.trim();
}

export interface Checkout {
	dir: string;
	repository: string;
	commit: string;
	committedAt: string;
	cleanup(): void;
}

export interface CheckoutOptions {
	/** `owner/name` on GitHub. */
	repository: string;
	/** Branch, tag or commit SHA. */
	ref: string;
	/** Sparse-checkout patterns (gitignore style, rooted with a leading `/`). */
	paths: string[];
	/** Timeout for each network step. */
	timeoutMs?: number;
}

/** Shallow, blob-filtered, sparse checkout of `paths` from a GitHub repository. */
export function checkout({
	repository,
	ref,
	paths,
	timeoutMs = 180_000
}: CheckoutOptions): Checkout {
	const dir = mkdtempSync(path.join(tmpdir(), 'grim-sync-'));
	const cleanup = () => rmSync(dir, { recursive: true, force: true });
	try {
		const url = `https://github.com/${repository}.git`;
		console.log(`Fetching ${repository}@${ref} ...`);
		git(['init', '--quiet'], dir, 10_000);
		git(['remote', 'add', 'origin', url], dir, 10_000);
		git(['sparse-checkout', 'set', '--no-cone', ...paths], dir, 10_000);
		git(['fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', ref], dir, timeoutMs);
		git(['checkout', '--quiet', 'FETCH_HEAD'], dir, timeoutMs);
		const commit = git(['rev-parse', 'HEAD'], dir, 10_000);
		const committedAt = git(['log', '-1', '--format=%cI'], dir, 10_000);
		console.log(`  at ${commit} (${committedAt})`);
		return { dir, repository, commit, committedAt, cleanup };
	} catch (error) {
		cleanup();
		throw error;
	}
}

export function readJson(file: string): unknown {
	if (!existsSync(file)) throw new SyncError(`Expected file is missing upstream: ${file}`);
	try {
		return JSON.parse(readFileSync(file, 'utf8'));
	} catch (error) {
		throw new SyncError(`${file} is not valid JSON: ${(error as Error).message}`);
	}
}

export function sha256(data: Buffer | string): string {
	return createHash('sha256').update(data).digest('hex');
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
		);
	}
	return value;
}

/** JSON with sorted keys, tab indentation and a trailing newline, so output is stable. */
export function stableJson(value: unknown): string {
	return `${JSON.stringify(sortKeys(value), null, '\t')}\n`;
}

/**
 * Chooses what to write for a generated metadata file. When the file already on disk
 * matches `next` once `withoutVolatile` has removed the fields that change on every run
 * (fetch date, source commit), the existing file is kept, so a sync with no real upstream
 * change leaves no diff.
 */
export function keepIfUnchanged<T>(
	file: string,
	next: T,
	withoutVolatile: (value: T) => unknown
): { content: string; changed: boolean } {
	if (existsSync(file)) {
		const current = readFileSync(file, 'utf8');
		try {
			const same =
				stableJson(withoutVolatile(JSON.parse(current) as T)) === stableJson(withoutVolatile(next));
			if (same) return { content: current, changed: false };
		} catch {
			// Unreadable or differently shaped file: replace it.
		}
	}
	return { content: stableJson(next), changed: true };
}

/** Reads `--name value` options. */
export function option(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const value = process.argv[i + 1];
	if (value === undefined || value.startsWith('--')) throw new SyncError(`--${name} needs a value`);
	return value;
}
