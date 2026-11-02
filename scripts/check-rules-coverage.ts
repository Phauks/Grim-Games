/**
 * Coverage gate for the rules tests (04-architecture.md §10), run by `npm run lint`.
 *
 * Fails when a character in static/data/roles.json or a jinx pair in jinxes.json has no test
 * file, when a test file does not cite the character's wiki page, or when a test file is left
 * over for a character or jinx that no longer exists, or when a `:reminder:` in TPI's night
 * text has no explicit token mapping (each rules file's `reminderPlaceholders`). Prints how many scenario `todo`s remain
 * and how many examples are written but waiting on the engine (`it.fails`): the roadmap tracks
 * both counts to zero for 1.0.
 *
 * `npm run check:rules-coverage -- --gaps` prints every `it.fails` grouped by the plan ID that
 * owns its gap (`engineGaps`), so the gap list lives in the tests, not in a hand-kept file.
 *
 * Fix a missing file with `npm run scaffold:rules-tests`.
 */
import { placeholderProblems } from '../src/lib/core/rules/night-text.ts';
import { readGameData, readTestFiles } from './lib/game-data-files.ts';
import {
	ABILITIES_DIR,
	checkCoverage,
	gapCounts,
	JINXES_DIR,
	renderGapList
} from './lib/rules-tests.ts';

const data = readGameData();
const abilityTests = readTestFiles(ABILITIES_DIR);
const jinxTests = readTestFiles(JINXES_DIR);

// `-- --gaps`: print every example waiting on the engine, grouped by the plan ID that owns it.
if (process.argv.includes('--gaps')) {
	console.log(
		`# Characters\n\n${renderGapList(abilityTests)}\n\n# Jinxes\n\n${renderGapList(jinxTests)}`
	);
	process.exit(0);
}

const report = checkCoverage({
	characters: data.characters,
	jinxes: data.jinxes.all,
	abilityTests,
	jinxTests
});

console.log(
	[
		`Rules test coverage:`,
		`  characters: ${report.characterFiles}/${data.characters.length} test files, ` +
			`${report.charactersDone} with every wiki scenario passing, ${report.characterTodos} scenario todos left, ` +
			`${report.characterFails} written but waiting on the engine`,
		`  jinxes:     ${report.jinxFiles}/${data.jinxes.all.length} test files, ` +
			`${report.jinxesDone} with the rule passing, ${report.jinxTodos} rule todos left, ` +
			`${report.jinxFails} written but waiting on the engine`,
		`  total todos: ${report.characterTodos + report.jinxTodos}`,
		`  total waiting on the engine (it.fails): ${report.characterFails + report.jinxFails}`,
		`  by plan ID: ${gapCounts([...abilityTests.values(), ...jinxTests.values()])}`
	].join('\n')
);

// Every `:reminder:` in TPI's night text says which token it means (`reminderPlaceholders`).
report.problems.push(...placeholderProblems(data.characters));

if (report.problems.length) {
	console.error(`\n${report.problems.join('\n')}`);
	console.error(
		`\n${report.problems.length} rules coverage problem(s). Run \`npm run scaffold:rules-tests\` ` +
			`to create missing test files; delete files for characters or jinxes TPI removed.`
	);
	process.exit(1);
}
