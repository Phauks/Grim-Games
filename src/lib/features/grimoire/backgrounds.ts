/**
 * Custom grimoire backgrounds (Trevor, 2026-10-16). The Storyteller picks an image from the
 * device; it is shrunk and kept in IndexedDB on this device only, never uploaded. A choice
 * belongs to one game or is the default for every game; a game's own choice wins.
 *
 * A script may name a background image (`_meta.background`, a link). It is only offered, and
 * only fetched once the Storyteller chooses it.
 */

export type BackgroundChoice =
	{ kind: 'none' } | { kind: 'image'; image: Blob } | { kind: 'script' };

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
	const value = raw as { kind?: unknown; image?: unknown };
	if (value.kind === 'none' || value.kind === 'script') return { kind: value.kind };
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
