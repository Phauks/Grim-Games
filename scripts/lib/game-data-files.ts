/** Reads the committed TPI data and the rules test files from disk, for the rules-test scripts. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameData, type GameData } from '../../src/lib/core/data/index.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readGameData(root = ROOT): GameData {
	const read = (file: string): unknown =>
		JSON.parse(readFileSync(path.join(root, 'static', 'data', file), 'utf8'));
	return loadGameData({
		roles: read('roles.json'),
		jinxes: read('jinxes.json'),
		nightsheet: read('nightsheet.json')
	});
}

/** `*.test.ts` files directly in `dir` (relative to root), by file name. */
export function readTestFiles(dir: string, root = ROOT): Map<string, string> {
	const full = path.join(root, dir);
	const files = new Map<string, string>();
	if (!existsSync(full)) return files;
	for (const name of readdirSync(full).sort()) {
		if (name.endsWith('.test.ts')) files.set(name, readFileSync(path.join(full, name), 'utf8'));
	}
	return files;
}
