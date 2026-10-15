/**
 * Syncs The Pandemonium Institute's toolmaker data into `static/data/`:
 *
 *   roles.json, jinxes.json, nightsheet.json   from botc-release resources/data/
 *   script-schema.json                         from botc-release (repository root)
 *   icons/<edition>/<file>.webp                from botc-release resources/characters/
 *   manifest.json                              source commit, fetch date, hashes, counts
 *
 * Everything is validated with the core parsers before anything is written, so a change
 * in TPI's format fails the sync instead of shipping data the app cannot read. Data files
 * are copied byte for byte; re-running with no upstream change leaves no diff.
 *
 * Usage: npm run sync:data [-- --ref <branch|tag|sha>] [-- --source <local botc-release checkout>]
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	characterIcons,
	CHARACTER_TYPES,
	checkScriptSchema,
	loadGameData,
	type CharacterType
} from '../src/lib/core/data/index.ts';
import {
	checkout,
	git,
	keepIfUnchanged,
	option,
	readJson,
	sha256,
	SyncError,
	type Checkout
} from './lib/sync-utils.ts';

const REPOSITORY = 'ThePandemoniumInstitute/botc-release';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static', 'data');
const ICONS_OUT = path.join(OUT, 'icons');

/** Output file name -> path in botc-release. */
const DATA_FILES = {
	'roles.json': 'resources/data/roles.json',
	'jinxes.json': 'resources/data/jinxes.json',
	'nightsheet.json': 'resources/data/nightsheet.json',
	'script-schema.json': 'script-schema.json'
} as const;
const ICONS_SOURCE = 'resources/characters';

interface FileEntry {
	source: string;
	bytes: number;
	sha256: string;
}

interface Manifest {
	source: { repository: string; commit: string; committedAt: string };
	fetchedAt: string;
	summary: {
		characters: number;
		byType: Record<CharacterType, number>;
		jinxes: number;
		firstNight: number;
		otherNight: number;
		icons: number;
		iconBytes: number;
	};
	files: Record<string, FileEntry>;
}

function localSource(dir: string): Checkout {
	return {
		dir,
		repository: REPOSITORY,
		commit: git(['rev-parse', 'HEAD'], dir, 10_000),
		committedAt: git(['log', '-1', '--format=%cI'], dir, 10_000),
		cleanup: () => {}
	};
}

function listIcons(dir: string): string[] {
	if (!existsSync(dir)) throw new SyncError(`Expected folder is missing upstream: ${ICONS_SOURCE}`);
	const files = (readdirSync(dir, { recursive: true }) as string[])
		.map((file) => file.split(path.sep).join('/'))
		.filter((file) => statSync(path.join(dir, file)).isFile())
		.sort();
	const unexpected = files.filter((file) => !/^[a-z0-9]+\/[a-z0-9_]+\.webp$/.test(file));
	if (unexpected.length > 0) {
		throw new SyncError(`Unexpected files in ${ICONS_SOURCE}: ${unexpected.join(', ')}`);
	}
	return files;
}

function main(): void {
	const sourceDir = option('source');
	const source = sourceDir
		? localSource(path.resolve(sourceDir))
		: checkout({
				repository: REPOSITORY,
				ref: option('ref') ?? 'main',
				paths: ['/resources/data/', `/${ICONS_SOURCE}/`, '/script-schema.json']
			});
	try {
		sync(source);
	} finally {
		source.cleanup();
	}
}

function sync(source: Checkout): void {
	const upstream = (file: string) => path.join(source.dir, file);

	// 1. Validate everything before touching static/data.
	const data = loadGameData({
		roles: readJson(upstream(DATA_FILES['roles.json'])),
		jinxes: readJson(upstream(DATA_FILES['jinxes.json'])),
		nightsheet: readJson(upstream(DATA_FILES['nightsheet.json']))
	});
	checkScriptSchema(readJson(upstream(DATA_FILES['script-schema.json'])));

	const iconsDir = upstream(ICONS_SOURCE);
	const icons = listIcons(iconsDir);
	const iconSet = new Set(icons);
	const missing: string[] = [];
	for (const character of data.characters) {
		for (const file of Object.values(characterIcons(character) ?? {})) {
			if (!iconSet.has(file)) missing.push(`${character.id}: ${file}`);
		}
	}
	if (missing.length > 0) {
		throw new SyncError(
			`Characters without their icons in ${ICONS_SOURCE}:\n  ${missing.join('\n  ')}`
		);
	}

	// 2. Write data files and replace the icons folder.
	mkdirSync(OUT, { recursive: true });
	const files: Record<string, FileEntry> = {};
	for (const [name, from] of Object.entries(DATA_FILES)) {
		const bytes = readFileSync(upstream(from));
		writeFileSync(path.join(OUT, name), bytes);
		files[name] = { source: from, bytes: bytes.length, sha256: sha256(bytes) };
	}
	rmSync(ICONS_OUT, { recursive: true, force: true });
	let iconBytes = 0;
	for (const file of icons) {
		const target = path.join(ICONS_OUT, file);
		mkdirSync(path.dirname(target), { recursive: true });
		copyFileSync(path.join(iconsDir, file), target);
		const bytes = readFileSync(target);
		iconBytes += bytes.length;
		files[`icons/${file}`] = {
			source: `${ICONS_SOURCE}/${file}`,
			bytes: bytes.length,
			sha256: sha256(bytes)
		};
	}

	// 3. Manifest. Kept as-is when only the commit or fetch date would change.
	const byType = Object.fromEntries(CHARACTER_TYPES.map((type) => [type, 0])) as Record<
		CharacterType,
		number
	>;
	for (const character of data.characters) byType[character.type]++;
	const manifest: Manifest = {
		source: {
			repository: source.repository,
			commit: source.commit,
			committedAt: source.committedAt
		},
		fetchedAt: new Date().toISOString(),
		summary: {
			characters: data.characters.length,
			byType,
			jinxes: data.jinxes.all.length,
			firstNight: data.nightSheet.firstNight.length,
			otherNight: data.nightSheet.otherNight.length,
			icons: icons.length,
			iconBytes
		},
		files
	};
	const manifestFile = path.join(OUT, 'manifest.json');
	const { content, changed } = keepIfUnchanged(manifestFile, manifest, (m) => ({
		...m,
		source: undefined,
		fetchedAt: undefined
	}));
	writeFileSync(manifestFile, content);

	const { summary } = manifest;
	console.log(
		[
			`Characters: ${summary.characters} (${CHARACTER_TYPES.map((t) => `${t} ${byType[t]}`).join(', ')})`,
			`Jinxes: ${summary.jinxes} pairs`,
			`Night sheet: first night ${summary.firstNight} steps, other nights ${summary.otherNight}`,
			`Icons: ${summary.icons} files, ${(iconBytes / 1024 / 1024).toFixed(1)} MB`,
			changed ? 'static/data updated.' : 'No upstream data changes.'
		].join('\n')
	);
}

try {
	main();
} catch (error) {
	console.error(`\nData sync failed.\n${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}
