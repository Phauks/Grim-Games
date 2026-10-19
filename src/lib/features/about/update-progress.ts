/**
 * How far a new build's download has got: the service worker sends this to every open page
 * while it stores the build at install, so About can say "Downloading update… 40%" instead
 * of "Checking…" (Trevor, 2026-10-18).
 */
export const PRECACHE_PROGRESS = 'PRECACHE_PROGRESS';

export interface PrecacheProgress {
	type: typeof PRECACHE_PROGRESS;
	/** Files stored so far, of `total`. */
	done: number;
	total: number;
	/**
	 * Bytes stored so far, of `totalBytes`, when the build published its file sizes
	 * (PRECACHE_SIZES_PATH). Trevor, 2026-10-18: "show size of update as well".
	 */
	bytes?: number;
	totalBytes?: number;
}

/** The build's file sizes, path to bytes, written by vite.config.ts (precacheSizes). */
export const PRECACHE_SIZES_PATH = '/precache-sizes.json';

export type PrecacheSizes = Record<string, number>;

/** The sizes file as read, keeping only whole non-negative byte counts. */
export function parseSizes(raw: unknown): PrecacheSizes {
	const sizes: PrecacheSizes = {};
	if (!raw || typeof raw !== 'object') return sizes;
	for (const [path, bytes] of Object.entries(raw))
		if (typeof bytes === 'number' && Number.isInteger(bytes) && bytes >= 0) sizes[path] = bytes;
	return sizes;
}

/** The download's total bytes, or undefined when the sizes file names none of its files. */
export function totalBytes(paths: readonly string[], sizes: PrecacheSizes): number | undefined {
	const total = paths.reduce((sum, path) => sum + (sizes[path] ?? 0), 0);
	return total > 0 ? total : undefined;
}

export function isPrecacheProgress(data: unknown): data is PrecacheProgress {
	const message = data as Partial<PrecacheProgress> | null;
	return (
		message?.type === PRECACHE_PROGRESS &&
		typeof message.done === 'number' &&
		typeof message.total === 'number' &&
		(message.bytes === undefined || typeof message.bytes === 'number') &&
		(message.totalBytes === undefined || typeof message.totalBytes === 'number')
	);
}

/** Whole percent done, 0 to 100: by bytes when the sizes are known, else by files. */
export function percentDone({
	done,
	total,
	bytes,
	totalBytes
}: Pick<PrecacheProgress, 'done' | 'total' | 'bytes' | 'totalBytes'>): number {
	const [part, whole] = bytes !== undefined && totalBytes ? [bytes, totalBytes] : [done, total];
	return whole > 0 ? Math.min(100, Math.floor((part / whole) * 100)) : 0;
}
