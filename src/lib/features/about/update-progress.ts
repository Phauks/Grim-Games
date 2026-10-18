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
}

export function isPrecacheProgress(data: unknown): data is PrecacheProgress {
	const message = data as Partial<PrecacheProgress> | null;
	return (
		message?.type === PRECACHE_PROGRESS &&
		typeof message.done === 'number' &&
		typeof message.total === 'number'
	);
}

/** Whole percent done, 0 to 100. */
export const percentDone = ({ done, total }: Pick<PrecacheProgress, 'done' | 'total'>): number =>
	total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
