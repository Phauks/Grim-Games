/**
 * Lint: raw hex colours belong in theme palettes only (04-architecture.md §9). Everything
 * else uses semantic or component tokens. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scanned = ['src'];
const allowed = ['src/lib/ui/themes/', 'src/lib/assets/'];
const extensions = /\.(ts|js|svelte|css|html)$/;

// `#abc`, `#aabbcc`, `#aabbccdd` not followed by more word characters, so `#lib/...`,
// `{#each}` and `{#if}` never match.
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;

export function findHexColours(source: string): { line: number; match: string }[] {
	const found: { line: number; match: string }[] = [];
	source.split('\n').forEach((text, index) => {
		for (const match of text.matchAll(HEX)) found.push({ line: index + 1, match: match[0] });
	});
	return found;
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (extensions.test(entry.name)) yield path;
	}
}

if (process.argv.includes('--run')) {
	let problems = 0;
	for (const dir of scanned) {
		for (const path of files(join(root, dir))) {
			const file = relative(root, path).split(sep).join('/');
			if (allowed.some((prefix) => file.startsWith(prefix))) continue;
			for (const { line, match } of findHexColours(readFileSync(path, 'utf8'))) {
				console.error(`${file}:${line}  ${match}  use a theme token instead of a hex colour`);
				problems++;
			}
		}
	}
	if (problems) {
		console.error(`\n${problems} hex colour(s) outside src/lib/ui/themes/.`);
		process.exit(1);
	}
}
