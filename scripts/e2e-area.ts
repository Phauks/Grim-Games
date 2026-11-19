/**
 * Runs the e2e tests of one area (e2e/areas.ts), or one CI job's part of it.
 *
 * `node scripts/e2e-area.ts --run <area> [part/jobs] [playwright options]`, or
 * `npm run test:e2e:area -- <area>`. CI passes the part, such as `board 2/3`.
 *
 * `node scripts/e2e-area.ts --plan [changed files...]` is CI's plan job: it prints the e2e job
 * matrix for a PR's changed files (all areas with no files given, as on beta and main), and
 * sets the step output `matrix` and the job summary when run in GitHub Actions.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
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

/** Why a changed file runs the areas it does. */
export type AreaReason = { file: string; areas: string[] | 'all' };

/**
 * The areas one changed file belongs to, or 'all' when it is outside every area's own
 * folders: shared code can break any area's tests, so only an area's own files narrow the run.
 */
export function areasForFile(file: string): string[] | 'all' {
	const test = /^e2e\/([^/]+\.e2e\.ts)$/.exec(file);
	if (test) {
		const area = E2E_AREAS.find((a) => a.files.includes(test[1]));
		return area ? [area.id] : 'all';
	}
	const feature =
		/^src\/lib\/features\/([^/]+)\//.exec(file)?.[1] ??
		/^src\/lib\/i18n\/messages\/en\/([^/]+)\.ts$/.exec(file)?.[1];
	if (!feature) return 'all';
	const areas = E2E_AREAS.filter((a) => a.features.includes(feature)).map((a) => a.id);
	return areas.length > 0 ? areas : 'all';
}

/** The areas a set of changed files runs; every area for none (a push to beta or main). */
export function plannedAreas(files: string[]): { areas: E2eArea[]; reasons: AreaReason[] } {
	const reasons = files.map((file) => ({ file, areas: areasForFile(file) }));
	if (files.length === 0 || reasons.some((r) => r.areas === 'all')) {
		return { areas: E2E_AREAS, reasons };
	}
	const ids = new Set(reasons.flatMap((r) => r.areas as string[]));
	return { areas: E2E_AREAS.filter((a) => ids.has(a.id)), reasons };
}

/** One CI job per part of each area. */
export function matrix(areas: E2eArea[]) {
	return areas.flatMap((a) =>
		Array.from({ length: a.jobs }, (_, i) => ({
			area: a.id,
			part: i + 1,
			of: a.jobs,
			label: a.jobs > 1 ? `${a.name} ${i + 1} of ${a.jobs}` : a.name
		}))
	);
}

/** The job summary: which areas run, which are skipped, and the files that decided it. */
export function planSummary(files: string[]): string {
	const { areas, reasons } = plannedAreas(files);
	const skipped = E2E_AREAS.filter((a) => !areas.includes(a));
	const lines = ['## E2E areas', '', `Running: ${areas.map((a) => a.name).join('; ')}`];
	lines.push(`Skipped: ${skipped.length > 0 ? skipped.map((a) => a.name).join('; ') : 'None'}`);
	if (files.length === 0) lines.push('', 'Every area runs on a push to beta or main.');
	const shared = reasons.filter((r) => r.areas === 'all').map((r) => r.file);
	if (shared.length > 0) {
		lines.push('', 'Every area runs because these files are outside the areas:', '');
		for (const file of shared.slice(0, 20)) lines.push(`- \`${file}\``);
		if (shared.length > 20) lines.push(`- and ${shared.length - 20} more`);
	}
	return lines.join('\n') + '\n';
}

if (process.argv.includes('--plan')) {
	const files = process.argv.slice(process.argv.indexOf('--plan') + 1).filter(Boolean);
	const json = JSON.stringify({ include: matrix(plannedAreas(files).areas) });
	console.log(planSummary(files));
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${json}\n`);
	if (process.env.GITHUB_STEP_SUMMARY)
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, planSummary(files));
}

if (process.argv.includes('--run')) {
	const args = process.argv.slice(process.argv.indexOf('--run') + 1);
	const area = areaById(args[0]);
	const part = args[1] && /^\d+\/\d+$/.test(args[1]) ? args[1] : undefined;
	const rest = args.slice(part ? 2 : 1);
	const result = spawnSync('npx', playwrightArgs(area, part, rest), { stdio: 'inherit' });
	process.exit(result.status ?? 1);
}
