/**
 * One-off, PROVISIONAL snapshot of numeric night-order positions into
 * `static/data/night-order-provisional.json`.
 *
 * TPI's data is the only real source and has no numbers: `nightsheet.json` is an ordered
 * list. Until we derive positions from that list ourselves, this takes the numbers from
 * Trevor's Official-Data-Sync repository (scraped from the script tool; 05-spike-results.md
 * S8). It is not part of the weekly sync and is meant to be replaced, not maintained.
 * Characters TPI does not have are dropped, and every disagreement with TPI's night sheet
 * is recorded in `_meta.disagreements` for review.
 *
 * Run `npm run sync:data` first (it reads TPI's data from static/data/).
 * Usage: npm run snapshot:night-order [-- --ref <branch|tag|sha>]
 */
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameData, type CharacterId, type GameData } from '../src/lib/core/data/index.ts';
import {
	checkout,
	keepIfUnchanged,
	option,
	readJson,
	SyncError,
	type Checkout
} from './lib/sync-utils.ts';

const REPOSITORY = 'Phauks/Blood-on-the-Clocktower---Official-Data-Sync';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static', 'data');
const NIGHTS = ['firstNight', 'otherNight'] as const;
type Night = (typeof NIGHTS)[number];

type Positions = Partial<Record<Night, number>>;

interface Disagreements {
	/** In TPI's data but not in Official-Data-Sync at all. */
	missingCharacters: CharacterId[];
	/** In Official-Data-Sync but not in TPI's data (dropped from the snapshot). */
	extraCharacters: CharacterId[];
	/** On TPI's night sheet for that night, with no number in Official-Data-Sync. */
	missingPositions: Record<Night, CharacterId[]>;
	/** Numbered in Official-Data-Sync but not on TPI's night sheet for that night (dropped). */
	extraPositions: Record<Night, CharacterId[]>;
	/** Adjacent pairs (in TPI order) whose numbers are not strictly increasing. */
	orderConflicts: Record<Night, string[]>;
}

interface NightOrderFile {
	_meta: {
		status: 'provisional';
		note: string;
		source: { repository: string; commit: string; committedAt: string; path: string };
		fetchedAt: string;
		disagreements: Disagreements;
	};
	[id: string]: Positions | NightOrderFile['_meta'];
}

function readPositions(dir: string): Map<CharacterId, Positions> {
	const base = path.join(dir, 'data', 'characters');
	const files = (readdirSync(base, { recursive: true }) as string[])
		.map((file) => file.split(path.sep).join('/'))
		.filter((file) => file.includes('/') && file.endsWith('.json'))
		.sort();
	if (files.length === 0)
		throw new SyncError(`No character files in ${REPOSITORY} data/characters/`);
	const positions = new Map<CharacterId, Positions>();
	for (const file of files) {
		const raw = readJson(path.join(base, file));
		if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
			throw new SyncError(`${file}: expected an object`);
		}
		const { id, firstNight, otherNight } = raw as Record<string, unknown>;
		if (typeof id !== 'string') throw new SyncError(`${file}: missing id`);
		if (positions.has(id)) throw new SyncError(`${file}: duplicate id ${id}`);
		const entry: Positions = {};
		for (const [night, value] of [
			['firstNight', firstNight],
			['otherNight', otherNight]
		] as const) {
			if (value === undefined || value === 0) continue; // 0 means "does not wake"
			if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
				throw new SyncError(`${file}: ${night} is not a position: ${JSON.stringify(value)}`);
			}
			entry[night] = value;
		}
		positions.set(id, entry);
	}
	return positions;
}

function main(): void {
	const data = loadGameData({
		roles: readJson(path.join(OUT, 'roles.json')),
		jinxes: readJson(path.join(OUT, 'jinxes.json')),
		nightsheet: readJson(path.join(OUT, 'nightsheet.json'))
	});
	const source = checkout({
		repository: REPOSITORY,
		ref: option('ref') ?? 'main',
		paths: ['/data/characters/']
	});
	try {
		write(data, source);
	} finally {
		source.cleanup();
	}
}

function write(data: GameData, source: Checkout): void {
	const ods = readPositions(source.dir);
	const byId = data.byId;
	const sorted = (ids: Iterable<string>) => [...ids].sort();

	const disagreements: Disagreements = {
		missingCharacters: sorted(data.characters.map((c) => c.id).filter((id) => !ods.has(id))),
		extraCharacters: sorted([...ods.keys()].filter((id) => !byId.has(id))),
		missingPositions: { firstNight: [], otherNight: [] },
		extraPositions: { firstNight: [], otherNight: [] },
		orderConflicts: { firstNight: [], otherNight: [] }
	};

	const snapshot = new Map<CharacterId, Positions>();
	for (const night of NIGHTS) {
		const listed = data.nightSheet[night].filter((id) => byId.has(id));
		const listedSet = new Set(listed);
		for (const id of listed) {
			const value = ods.get(id)?.[night];
			if (value === undefined) {
				if (ods.has(id)) disagreements.missingPositions[night].push(id);
				continue;
			}
			snapshot.set(id, { ...snapshot.get(id), [night]: value });
		}
		for (const [id, entry] of ods) {
			if (entry[night] !== undefined && byId.has(id) && !listedSet.has(id)) {
				disagreements.extraPositions[night].push(id);
			}
		}
		const numbered = listed.filter((id) => snapshot.get(id)?.[night] !== undefined);
		for (let i = 1; i < numbered.length; i++) {
			const [a, b] = [numbered[i - 1], numbered[i]];
			if (snapshot.get(a)![night]! >= snapshot.get(b)![night]!) {
				disagreements.orderConflicts[night].push(
					`${a} (${snapshot.get(a)![night]}) before ${b} (${snapshot.get(b)![night]})`
				);
			}
		}
		disagreements.missingPositions[night].sort();
		disagreements.extraPositions[night].sort();
	}

	const file: NightOrderFile = {
		_meta: {
			status: 'provisional',
			note: 'Provisional numeric night order, a one-off snapshot of Official-Data-Sync numbers for characters on TPI night sheet. TPI nightsheet.json order is authoritative; replace this file rather than updating it.',
			source: {
				repository: source.repository,
				commit: source.commit,
				committedAt: source.committedAt,
				path: 'data/characters/<edition>/<id>.json'
			},
			fetchedAt: new Date().toISOString(),
			disagreements
		}
	};
	for (const id of sorted(snapshot.keys())) file[id] = snapshot.get(id)!;

	const target = path.join(OUT, 'night-order-provisional.json');
	const { content, changed } = keepIfUnchanged(target, file, (f) => ({
		...f,
		_meta: { ...f._meta, fetchedAt: undefined }
	}));
	writeFileSync(target, content);

	const count = (list: Record<Night, string[]>) =>
		NIGHTS.map((night) => `${night} ${list[night].length}`).join(', ');
	console.log(
		[
			`Snapshot: ${snapshot.size} characters with a provisional position.`,
			`Missing from ${REPOSITORY}: ${disagreements.missingCharacters.join(', ') || 'none'}`,
			`Not in TPI data: ${disagreements.extraCharacters.join(', ') || 'none'}`,
			`On TPI night sheet without a number: ${count(disagreements.missingPositions)}`,
			`Numbered but not on TPI night sheet: ${count(disagreements.extraPositions)}`,
			`Order conflicts with TPI: ${count(disagreements.orderConflicts)}`,
			changed ? `Wrote ${path.relative(ROOT, target)}.` : 'No changes.'
		].join('\n')
	);
}

try {
	main();
} catch (error) {
	console.error(
		`\nNight-order snapshot failed.\n${error instanceof Error ? error.message : String(error)}`
	);
	process.exit(1);
}
