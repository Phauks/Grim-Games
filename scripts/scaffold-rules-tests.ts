/**
 * Creates the missing rules test files (04-architecture.md §10): one per character in
 * src/lib/core/abilities/<id>.test.ts and one per jinx pair in
 * src/lib/core/jinxes/<a>__<b>.test.ts. Existing files are never touched, so run it after a
 * data sync adds a character or jinx, then write the scenarios.
 *
 *   npm run scaffold:rules-tests                      generic `it.todo('wiki examples')`
 *   npm run scaffold:rules-tests -- --fetch-examples  one todo per wiki example, fetched live
 *   npm run scaffold:rules-tests -- --examples <file> todo titles from a local JSON file,
 *                                                     { "<characterId>": ["short gist", ...] }
 *
 * `--fetch-examples` reads each new character's wiki page through the MediaWiki API and only
 * counts its examples (titles "Example 1", "Example 2", ...); no wiki text is written. An
 * `--examples` file holds titles you paraphrased yourself; keep it out of the repository.
 * If the wiki can't be reached, the generic todo is used.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { ROOT, readGameData } from './lib/game-data-files.ts';
import {
	ABILITIES_DIR,
	characterTestFile,
	JINXES_DIR,
	jinxTestFile,
	renderCharacterTest,
	renderJinxTest,
	WIKI_BASE
} from './lib/rules-tests.ts';

function option(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const value = process.argv[i + 1];
	if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
	return value;
}

async function wikiApi(params: Record<string, string>): Promise<unknown> {
	const url = new URL('api.php', WIKI_BASE);
	for (const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2' })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return response.json();
}

/** Number of examples on a character's wiki page (each is a `<div class='example'>`). */
async function fetchExampleCount(name: string): Promise<number> {
	const page = name.replace(/ /g, '_');
	const sections = (await wikiApi({ action: 'parse', page, prop: 'sections' })) as {
		parse?: { sections?: { line: string; index: string }[] };
	};
	const examples = sections.parse?.sections?.find((s) => s.line.trim() === 'Examples');
	if (!examples) return 0;
	const section = (await wikiApi({
		action: 'parse',
		page,
		prop: 'wikitext',
		section: examples.index
	})) as { parse?: { wikitext?: string } };
	return section.parse?.wikitext?.match(/class\s*=\s*["']example["']/g)?.length ?? 0;
}

async function main(): Promise<void> {
	const data = readGameData();
	const examplesFile = option('examples');
	const examples: Record<string, string[]> = examplesFile
		? JSON.parse(readFileSync(path.resolve(examplesFile), 'utf8'))
		: {};
	const fetchExamples = process.argv.includes('--fetch-examples');

	const prettierConfig = await resolveConfig(path.join(ROOT, ABILITIES_DIR, 'x.test.ts'));
	const write = async (dir: string, file: string, source: string) => {
		const full = path.join(ROOT, dir, file);
		mkdirSync(path.dirname(full), { recursive: true });
		writeFileSync(full, await format(source, { ...prettierConfig, filepath: full }));
	};

	let wikiReachable = fetchExamples;
	const created = { characters: 0, jinxes: 0, todos: 0 };
	for (const character of data.characters) {
		const file = characterTestFile(character.id);
		if (existsSync(path.join(ROOT, ABILITIES_DIR, file))) continue;
		let titles = examples[character.id];
		if (!titles && wikiReachable) {
			try {
				const count = await fetchExampleCount(character.name);
				titles = Array.from({ length: count }, () => '');
			} catch (error) {
				console.warn(`Wiki not reachable, using a generic todo from now on: ${String(error)}`);
				wikiReachable = false;
			}
		}
		const source = renderCharacterTest(character, data.nightSheet, titles);
		await write(ABILITIES_DIR, file, source);
		created.characters++;
		created.todos += titles?.length || 1;
	}

	for (const { characters } of data.jinxes.all) {
		const file = jinxTestFile(...characters);
		if (existsSync(path.join(ROOT, JINXES_DIR, file))) continue;
		const [a, b] = characters.map((id) => data.byId.get(id)!);
		await write(JINXES_DIR, file, renderJinxTest(a, b));
		created.jinxes++;
		created.todos++;
	}

	console.log(
		`Created ${created.characters} character and ${created.jinxes} jinx test file(s) ` +
			`with ${created.todos} todo(s). Existing files were left unchanged.`
	);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
