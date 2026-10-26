/**
 * Recorded sounds (plans U3 and U6): fetched when first played, decoded once per page, and
 * shared by day and night sound and the soundboard. Undefined when a recording can't be
 * fetched or decoded, as offline before it was ever stored, so it is left out.
 */

const decoded = new Map<string, Promise<AudioBuffer | undefined>>();

export function recording(ctx: AudioContext, url: string): Promise<AudioBuffer | undefined> {
	let buffer = decoded.get(url);
	if (!buffer) {
		buffer = fetch(url)
			.then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
			.then((data) => ctx.decodeAudioData(data))
			.catch(() => {
				decoded.delete(url);
				return undefined;
			});
		decoded.set(url, buffer);
	}
	return buffer;
}
