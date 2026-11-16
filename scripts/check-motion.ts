/**
 * Lint: one switch stops every animation (Trevor, 2026-11-16: one Animations setting for
 * players, Storytellers and spectators). Styles check `:root[data-motion-off]` and scripts
 * call `animationsOn()` (src/lib/ui/animations.svelte.ts), which alone reads the device's
 * Reduce motion. A style or script that reads the device itself would ignore the setting.
 *
 * Scans src. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The one file that may read the device's own setting. */
const OWNER = 'src/lib/ui/animations.svelte.ts';
const DEVICE_MOTION = /prefers-reduced-motion|prefersReducedMotion/;

/** Lines that read the device's Reduce motion themselves, as 1-based line numbers. */
export function motionProblems(file: string, text: string): number[] {
	if (file === OWNER) return [];
	const lines: number[] = [];
	text.split('\n').forEach((line, index) => {
		if (DEVICE_MOTION.test(line)) lines.push(index + 1);
	});
	return lines;
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(svelte|ts|css)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) yield path;
	}
}

if (process.argv.includes('--run')) {
	const root = fileURLToPath(new URL('..', import.meta.url));
	let failed = false;
	for (const path of files(join(root, 'src'))) {
		const file = relative(root, path).split(sep).join('/');
		for (const line of motionProblems(file, readFileSync(path, 'utf8'))) {
			failed = true;
			console.error(
				`${file}:${line}: reads the device's Reduce motion. Use :root[data-motion-off] in styles or animationsOn() in scripts.`
			);
		}
	}
	if (failed) process.exit(1);
}
