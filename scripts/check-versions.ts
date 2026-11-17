/**
 * CI: the format and protocol numbers never go down (update review, 2026-11-16). Phones keep
 * the build they have for hours and a saved game is never converted, so going back is never a
 * fix: an older build refuses games a newer one saved ("too-new") and can tell phones on the
 * newer protocol nothing they understand. A broken deploy is undone by a new commit that
 * reverts it while keeping these numbers (README "Rolling back").
 *
 * `node scripts/check-versions.ts --run <base ref>` compares the checkout with the base branch
 * of the pull request (fetched by the CI step) and fails when any number is lower.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Each number, the file that defines it, and the files it lived in before. */
const VERSIONS = [
	{
		name: 'SAVED_GAME_VERSION',
		files: ['src/lib/core/engine/saved-game-version.ts', 'src/lib/core/engine/persistence.ts']
	},
	{ name: 'ROOM_PROTOCOL', files: ['src/lib/core/sync/room-version.ts'] },
	{ name: 'MIN_ROOM_PROTOCOL', files: ['src/lib/core/sync/room-version.ts'] }
] as const;

/** The number `export const NAME = 12;` sets in the source, if it does. */
export function readVersion(source: string, name: string): number | undefined {
	const found = new RegExp(`export const ${name} = (\\d+);`).exec(source);
	return found ? Number(found[1]) : undefined;
}

/** A line for each number that is lower than on the base branch. */
export function lowered(
	base: Record<string, number | undefined>,
	head: Record<string, number | undefined>
): string[] {
	return Object.entries(base).flatMap(([name, was]) => {
		const now = head[name];
		return was !== undefined && now !== undefined && now < was
			? [`${name} went down from ${was} to ${now}; it never goes down.`]
			: [];
	});
}

/** Each number as `read` gives the files: the first file that sets it. */
function versions(read: (file: string) => string | undefined): Record<string, number | undefined> {
	return Object.fromEntries(
		VERSIONS.map(({ name, files }) => [
			name,
			files
				.map((file) => read(file))
				.map((source) => (source === undefined ? undefined : readVersion(source, name)))
				.find((value) => value !== undefined)
		])
	);
}

function atRef(ref: string, file: string): string | undefined {
	try {
		return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', stdio: 'pipe' });
	} catch {
		return undefined;
	}
}

function inCheckout(file: string): string | undefined {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return undefined;
	}
}

if (process.argv[2] === '--run') {
	const ref = process.argv[3];
	if (!ref) throw new Error('Name the base ref: node scripts/check-versions.ts --run origin/beta');
	const head = versions(inCheckout);
	const missing = Object.entries(head).filter(([, value]) => value === undefined);
	if (missing.length) {
		console.error(`Not found: ${missing.map(([name]) => name).join(', ')}`);
		process.exit(1);
	}
	const problems = lowered(
		versions((file) => atRef(ref, file)),
		head
	);
	for (const problem of problems) console.error(problem);
	if (problems.length) process.exit(1);
	console.log(`Versions against ${ref}: none went down.`);
}
