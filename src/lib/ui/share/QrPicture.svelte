<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { qrPicture } from './qr-picture.svelte.ts';

	/**
	 * The Storyteller's own picture in a QR code's middle, shaped as Settings says (Trevor,
	 * 2026-10-23): the whole picture or filling the square, zoomed in, with square, rounded
	 * or round corners. The share screen and the Settings preview draw it the same way.
	 */
	const looks = $derived(preferences.current);
</script>

<span
	class="qr-picture"
	data-testid="qr-picture"
	data-corners={looks.qrPictureCorners}
	data-whole={looks.qrPictureWhole || undefined}
	style:--zoom={looks.qrPictureZoom}><img src={qrPicture.current} alt="" /></span
>

<style>
	.qr-picture {
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.qr-picture[data-corners='rounded'] {
		border-radius: 18%;
	}
	.qr-picture[data-corners='circle'] {
		border-radius: 50%;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(var(--zoom));
	}
	[data-whole] img {
		object-fit: contain;
	}
</style>
