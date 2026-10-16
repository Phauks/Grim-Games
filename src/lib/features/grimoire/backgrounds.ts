/**
 * Custom grimoire backgrounds (Trevor, 2026-10-16). The Storyteller picks an image from the
 * device; it is shrunk and kept in IndexedDB on this device only, never uploaded. A choice
 * belongs to one game or is the default for every game; a game's own choice wins.
 *
 * A script may name a background image (`_meta.background`, a link). It is only offered, and
 * only fetched once the Storyteller chooses it.
 */

export type BackgroundChoice =
	| { kind: 'none' }
	| { kind: 'image'; image: Blob }
	| { kind: 'script' }
	| { kind: 'preset'; id: PresetId };

/**
 * Built-in backgrounds (Trevor, 2026-10-16), drawn in CSS so there is nothing to license
 * or precache. Each is a CSS `background` value.
 */
export const PRESETS = {
	wood: {
		label: 'Dark wood',
		css: `repeating-linear-gradient(92deg, oklch(0.3 0.04 55) 0 0.6rem, oklch(0.27 0.045 50) 0.6rem 1.1rem, oklch(0.32 0.04 58) 1.1rem 1.5rem), oklch(0.28 0.04 55)`
	},
	felt: {
		label: 'Green felt',
		css: `radial-gradient(ellipse at center, oklch(0.42 0.09 155) 0%, oklch(0.3 0.07 155) 70%, oklch(0.22 0.05 155) 100%)`
	},
	parchment: {
		label: 'Parchment',
		css: `radial-gradient(ellipse at center, oklch(0.85 0.05 85) 0%, oklch(0.74 0.07 75) 75%, oklch(0.6 0.08 65) 100%)`
	},
	night: {
		label: 'Night sky',
		css: [
			'radial-gradient(circle at 20% 30%, oklch(0.95 0 0) 0 0.07rem, transparent 0.09rem) 0 0 / 2.3rem 2.3rem',
			'radial-gradient(circle at 70% 60%, oklch(0.9 0.02 250) 0 0.05rem, transparent 0.07rem) 0.6rem 1.1rem / 3.7rem 3.7rem',
			'radial-gradient(circle at 40% 80%, oklch(0.97 0 0) 0 0.09rem, transparent 0.11rem) 1.4rem 0.3rem / 5.3rem 5.3rem',
			'radial-gradient(ellipse at top, oklch(0.32 0.08 270) 0%, oklch(0.16 0.05 265) 80%)'
		].join(', ')
	},
	stone: {
		label: 'Stone',
		css: `radial-gradient(ellipse at center, oklch(0.42 0.01 60) 0%, oklch(0.28 0.01 60) 80%)`
	}
} as const;
export type PresetId = keyof typeof PRESETS;
const isPreset = (id: unknown): id is PresetId => typeof id === 'string' && id in PRESETS;

/** Where a choice applies: one game, or every game without its own. */
export type BackgroundScope = { gameId: string } | 'default';

const DB_NAME = 'grim-games-backgrounds';
const STORE = 'choices';
/** Longest side of a stored image: sharp on a tablet, small enough to keep many. */
export const MAX_SIDE = 1920;

const keyOf = (scope: BackgroundScope) =>
	scope === 'default' ? 'default' : `game:${scope.gameId}`;

let db: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
	db ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			db = undefined;
			reject(request.error);
		};
	});
	return db;
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>) {
	const tx = (await open()).transaction(STORE, mode);
	const request = act(tx.objectStore(STORE));
	return new Promise<T>((resolve, reject) => {
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

function parse(raw: unknown): BackgroundChoice | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const value = raw as { kind?: unknown; image?: unknown; id?: unknown };
	if (value.kind === 'none' || value.kind === 'script') return { kind: value.kind };
	if (value.kind === 'preset' && isPreset(value.id)) return { kind: 'preset', id: value.id };
	if (value.kind === 'image' && value.image instanceof Blob)
		return { kind: 'image', image: value.image };
	return undefined;
}

/** The choice saved for exactly this scope, if any. */
export async function readBackground(
	scope: BackgroundScope
): Promise<BackgroundChoice | undefined> {
	return parse(await run('readonly', (store) => store.get(keyOf(scope))));
}

/** A game's background: its own choice, else the default, else none. */
export async function backgroundFor(gameId: string): Promise<BackgroundChoice> {
	return (
		(await readBackground({ gameId })) ?? (await readBackground('default')) ?? { kind: 'none' }
	);
}

export async function saveBackground(scope: BackgroundScope, choice: BackgroundChoice) {
	await run('readwrite', (store) => store.put(choice, keyOf(scope)));
}

/** Forgets a game's own choice, so it follows the default again. */
export async function clearBackground(scope: BackgroundScope) {
	await run('readwrite', (store) => store.delete(keyOf(scope)));
}

/** Shrinks a picked image to at most `MAX_SIDE` on its longest side, as a JPEG. */
export async function shrinkImage(file: Blob): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Image could not be read'))),
			'image/jpeg',
			0.85
		)
	);
}
