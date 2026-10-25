/**
 * On an `<img>` showing a character's icon: once, if it fails to load, swap to `fallback`
 * (for a character, `fallbackIconUrl` in features/characters). Use as `{@attach iconFallback(fallback)}`,
 * with `referrerpolicy="no-referrer"` on the `<img>`: hosts that block hotlinking, such as
 * the BOTC HomeBrew Wiki's art, refuse an image asked for from another site's page.
 */
export function iconFallback(fallback: string | undefined) {
	return (img: HTMLImageElement) => {
		if (!fallback) return;
		const swap = () => {
			if (img.src.endsWith(fallback)) return;
			img.src = fallback;
		};
		// An image that already failed before this ran (cached error) swaps at once.
		if (img.complete && img.naturalWidth === 0 && img.currentSrc) swap();
		img.addEventListener('error', swap);
		return () => img.removeEventListener('error', swap);
	};
}
