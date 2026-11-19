/**
 * Runs the e2e tests of one area (e2e/areas.ts), or one CI job's part of it.
 *
 * `node scripts/e2e-area.ts --run <area> [part/jobs] [playwright options]`, or
 * `npm run test:e2e:area -- <area>`. CI passes the part, such as `board 2/3`.
 */
import { spawnSync } from 'node:child_process';
import { E2E_AREAS, type E2eArea } from '../e2e/areas.ts';

/** The area with this id; throws with the list of ids otherwise. */
export function areaById(id: string | undefined): E2eArea {
	const area = E2E_AREAS.find((a) => a.id === id);
	if (!area)
		throw new Error(`Unknown e2e area "${id}". Areas: ${E2E_AREAS.map((a) => a.id).join(', ')}`);
	return area;
}

/**
 * Playwright's arguments for an area. Files are given from e2e/ so `day.e2e.ts` never also
 * matches `grimoire-day.e2e.ts` (Playwright reads each as a pattern over the path).
 */
export function playwrightArgs(area: E2eArea, part: string | undefined, rest: string[]): string[] {
	const files = area.files.map((f) => `e2e/${f.replaceAll('.', '\\.')}$`);
	const shard = part && part !== '1/1' ? [`--shard=${part}`] : [];
	return ['playwright', 'test', ...files, ...shard, ...rest];
}

if (process.argv.includes('--run')) {
	const args = process.argv.slice(process.argv.indexOf('--run') + 1);
	const area = areaById(args[0]);
	const part = args[1] && /^\d+\/\d+$/.test(args[1]) ? args[1] : undefined;
	const rest = args.slice(part ? 2 : 1);
	const result = spawnSync('npx', playwrightArgs(area, part, rest), { stdio: 'inherit' });
	process.exit(result.status ?? 1);
}
