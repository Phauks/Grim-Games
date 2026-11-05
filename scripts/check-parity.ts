/**
 * Parity gate (M57, /mnt/project-files/engine-audit/engine-parity-audit.md): the goal is an
 * engine that runs every official character as a custom one, so custom characters can do
 * anything official ones can.
 *
 * Runs the rules tests with `vitest.parity.config.ts` (every official character with no
 * edition, its rules block on the character, no official overlay to fall back on, no place on
 * TPI's night sheet) and compares the failing behaviour tests with
 * src/lib/core/testing/parity/todo.json. That list only shrinks:
 * - a failure not on the list fails the gate (a new official-only path, or a new test the custom
 *   path can't pass yet: make it pass, or say why in the PR and add it with `-- --add`);
 * - a listed test that passes now fails the gate until it is taken off (`-- --update`).
 *
 * `npm run check:parity` checks; `-- --update` takes passing tests off the list; `-- --add`
 * also puts new failures on it.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareParity, parityFailures, readVitestJson } from './lib/parity.ts';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const todoFile = join(root, 'src/lib/core/testing/parity/todo.json');
const dir = mkdtempSync(join(tmpdir(), 'grim-parity-'));
const out = join(dir, 'report.json');

const run = spawnSync(
	'npx',
	[
		'vitest',
		'run',
		'--config',
		'vitest.parity.config.ts',
		'--reporter=json',
		`--outputFile=${out}`
	],
	{ cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }
);
let report: unknown;
try {
	report = JSON.parse(readFileSync(out, 'utf8'));
} catch {
	console.error(`The parity run wrote no report (exit ${run.status}).`);
	process.exit(1);
} finally {
	rmSync(dir, { recursive: true, force: true });
}

const results = readVitestJson(report, root);
const failures = parityFailures(results);
const todo = JSON.parse(readFileSync(todoFile, 'utf8')) as string[];
const { added, fixed, failing, listed } = compareParity(failures, todo);
const behaviour = results.filter((r) => !r.name.includes('data (roles.json)')).length;

const update = process.argv.includes('--update');
const add = process.argv.includes('--add');
if (update || add) {
	const next = add ? failures : todo.filter((t) => !fixed.includes(t));
	writeFileSync(todoFile, `${JSON.stringify(next, null, '\t')}\n`);
	console.log(`Parity list: ${next.length} test(s) (was ${listed}).`);
	process.exit(0);
}

console.log(
	`Parity (official characters as custom ones): ${behaviour - failing}/${behaviour} behaviour ` +
		`tests pass, ${failing} waiting on the engine (list: ${listed}).`
);
if (fixed.length) {
	console.error(
		`\nThese pass as custom characters now; take them off with \`npm run check:parity -- --update\`:`
	);
	for (const f of fixed) console.error(`  ${f}`);
}
if (added.length) {
	console.error(`\nThese fail only when the characters are custom (an official-only path?):`);
	for (const f of added) console.error(`  ${f}`);
}
if (fixed.length || added.length) process.exit(1);
