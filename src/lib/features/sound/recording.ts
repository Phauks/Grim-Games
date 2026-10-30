/**
 * Recorded sounds (plans U3 and U6): fetched when first played, decoded, and shared by day and
 * night sound and the soundboard. Undefined when a recording can't be fetched or decoded, as
 * offline before it was ever stored, so it is left out.
 *
 * A decoded recording is raw samples: a two-minute day or night recording is about 42 MB, ten
 * times its file. Only the ones played most recently are kept, up to `KEEP_BYTES`, so a game's
 * day and night pair and the soundboard stay ready while every other recording heard or previewed
 * once is let go; one played again is decoded again (under a second) from the stored file.
 */
import { fetchWithTimeout, SLOW_FETCH_TIMEOUT_MS } from '#lib/ui/fetch.ts';

/** About two day or night recordings and a few soundboard sounds. */
export const KEEP_BYTES = 100_000_000;

/** Oldest first: a Map keeps the order entries were (re)inserted. */
const decoded = new Map<string, Promise<AudioBuffer | undefined>>();
const sizes = new Map<string, number>();

/** Float32 samples per channel. */
const bytesOf = (buffer: AudioBuffer) => buffer.length * buffer.numberOfChannels * 4;

/** Lets go of the least recently played recordings until the rest fit, never `keep`. */
function trim(keep: string): void {
	let total = 0;
	for (const size of sizes.values()) total += size;
	for (const [url, size] of sizes) {
		if (total <= KEEP_BYTES) return;
		if (url === keep) continue;
		decoded.delete(url);
		sizes.delete(url);
		total -= size;
	}
}

export function recording(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | undefined> {
	let buffer = decoded.get(url);
	if (buffer) {
		// Most recently played: to the end of the order.
		decoded.delete(url);
		decoded.set(url, buffer);
		const size = sizes.get(url);
		if (size !== undefined) {
			sizes.delete(url);
			sizes.set(url, size);
		}
		return buffer;
	}
	buffer = fetchWithTimeout(url, { timeoutMs: SLOW_FETCH_TIMEOUT_MS })
		.then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
		.then((data) => ctx.decodeAudioData(data))
		.then((data) => {
			if (decoded.get(url) === buffer) {
				sizes.set(url, bytesOf(data));
				trim(url);
			}
			return data;
		})
		.catch(() => {
			if (decoded.get(url) === buffer) decoded.delete(url);
			return undefined;
		});
	decoded.set(url, buffer);
	return buffer;
}
