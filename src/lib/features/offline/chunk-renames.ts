/**
 * Rebuilds a renamed build file from the copy an earlier build stored, instead of downloading it.
 *
 * A build file's name carries a hash of its content, and that content includes the names of the
 * files it imports. So when one shared file changes, every file importing it, directly or not,
 * gets a new name although nothing else in it changed. Measured on beta (2026-10-23, PR 461 to
 * PR 463): an update downloaded 105 files, and 96 of them differed from a stored file only in
 * those names. The service worker downloads one file at a time per slot, so the count, more than
 * the bytes, made updates slow on a phone.
 *
 * The build publishes, for each build file, its content hash, the hash of its "shape" (the
 * content with every build file name blanked) and the build file names it names, in order
 * (`/precache-chunks.json`, written by vite.config.ts). A new file whose shape an earlier file
 * shares is rebuilt from that file by putting the new names in, and kept only when its content
 * hash comes out as published; otherwise it is downloaded as before.
 *
 * Hashing is left to the caller (node:crypto in the build, SubtleCrypto in the service worker):
 * both take the first 16 hex digits of SHA-256 over the file's UTF-8 bytes.
 */

/** Where the build publishes each build file's hashes and names (`ChunkInfo`). */
export const PRECACHE_CHUNKS_PATH = '/precache-chunks.json';

/** Build files whose text can name other build files. */
export const REBUILDABLE = /^\/_app\/immutable\/.+\.(js|css)$/;

export interface ChunkInfo {
	/** Hash of the file's content. */
	hash: string;
	/** Hash of the content with each build file name it names blanked (`shapeOf`). */
	shape: string;
	/** The build file names it names, in order, as file names without folders. */
	names: string[];
}

export type Chunks = Record<string, ChunkInfo>;

/** Stands in for each build file name in a file's shape. */
const BLANK = '\u0000';

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches the given build file names wherever a path names one (after a `/`). Longest first,
 * so a name that ends another name is not matched inside it.
 */
export function namePattern(names: Iterable<string>): RegExp | undefined {
	const list = [...new Set(names)].sort((a, b) => b.length - a.length).map(escape);
	return list.length ? new RegExp(`(?<=/)(?:${list.join('|')})`, 'g') : undefined;
}

/** The build file names a file's text names, in order. */
export function namesIn(text: string, pattern: RegExp | undefined): string[] {
	return pattern ? [...text.matchAll(pattern)].map((match) => match[0]) : [];
}

/** A file's text with each build file name blanked: what `ChunkInfo.shape` hashes. */
export function shapeOf(text: string, pattern: RegExp | undefined): string {
	return pattern ? text.replace(pattern, BLANK) : text;
}

/** The file name of a build file path. */
export function fileName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * An earlier file's text with the new file's names put in place of its own, in order; undefined
 * when they name a different number of files.
 */
export function renamed(
	text: string,
	pattern: RegExp | undefined,
	names: string[]
): string | undefined {
	if (namesIn(text, pattern).length !== names.length) return undefined;
	let i = 0;
	return pattern ? text.replace(pattern, () => names[i++]) : text;
}

/** The earlier build's files by shape, to find the one a new file can be rebuilt from. */
export function byShape(chunks: Chunks): Map<string, string> {
	const index = new Map<string, string>();
	for (const [path, info] of Object.entries(chunks)) index.set(info.shape, path);
	return index;
}

/** The chunks file as read, keeping only well-formed entries. */
export function parseChunks(raw: unknown): Chunks {
	const chunks: Chunks = {};
	if (!raw || typeof raw !== 'object') return chunks;
	for (const [path, info] of Object.entries(raw)) {
		if (!info || typeof info !== 'object') continue;
		const { hash, shape, names } = info as Partial<ChunkInfo>;
		if (typeof hash !== 'string' || typeof shape !== 'string' || !Array.isArray(names)) continue;
		if (!names.every((name) => typeof name === 'string')) continue;
		chunks[path] = { hash, shape, names };
	}
	return chunks;
}

/**
 * The chunks file for a build's text files, given every build file's path (fonts and images
 * are named too) and a hash function.
 */
export function describeChunks(
	files: Record<string, string>,
	paths: Iterable<string>,
	hash: (text: string) => string
): Chunks {
	const pattern = namePattern([...paths].map(fileName));
	const chunks: Chunks = {};
	for (const [path, text] of Object.entries(files)) {
		chunks[path] = {
			hash: hash(text),
			shape: hash(shapeOf(text, pattern)),
			names: namesIn(text, pattern)
		};
	}
	return chunks;
}
