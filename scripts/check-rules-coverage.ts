/**
 * Coverage gate for the rules tests (04-architecture.md §10), run by `npm run lint`.
 *
 * Fails when a character in static/data/roles.json or a jinx pair in jinxes.json has no test
 * file, when a test file does not cite the character's wiki page, or when a test file is left
 * over for a character or jinx that no longer exists, or when a `:reminder:` in TPI's night
 * text has no explicit token mapping (each rules file's `reminderPlaceholders`). Prints how many scenario `todo`s remain:
 * the roadmap tracks that count to zero for 1.0.
 *
 * Fix a missing file with `npm run scaffold:rules-tests`.
 */
import { placeholderProblems } from '../src/lib/core/rules/night-text.ts';
import { readGameData, readTestFiles } from './lib/game-data-files.ts';
import { ABILITIES_DIR, checkCoverage, JINXES_DIR } from './lib/rules-tests.ts';

const data = readGameData();
const report = checkCoverage({
	characters: data.characters,
	jinxes: data.jinxes.all,
	abilityTests: readTestFiles(ABILITIES_DIR),
	jinxTests: readTestFiles(JINXES_DIR)
});

console.log(
	[
		`Rules test coverage:`,
		`  characters: ${report.characterFiles}/${data.characters.length} test files, ` +
			`${report.charactersDone} with every wiki scenario written, ${report.characterTodos} scenario todos left`,
		`  jinxes:     ${report.jinxFiles}/${data.jinxes.all.length} test files, ` +
			`${report.jinxesDone} with the rule tested, ${report.jinxTodos} rule todos left`,
		`  total todos: ${report.characterTodos + report.jinxTodos}`
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
