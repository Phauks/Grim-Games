<script lang="ts" module>
	/**
	 * The most bytes a QR code holds (version 40, byte mode): 2,953 at the lowest error
	 * correction, 1,273 at the highest. Longer values are not drawn; check with `fitsQrCode`.
	 */
	export const QR_MAX_LENGTH = 2900;
	/** At the highest correction, which a picture over the middle needs. */
	export const QR_MAX_LENGTH_CENTRED = 1250;

	function bytes(value: string): number {
		return new TextEncoder().encode(value).length;
	}

	export function fitsQrCode(value: string): boolean {
		return bytes(value) <= QR_MAX_LENGTH;
	}

	/** Whether a picture can sit in the middle of this value's QR code and it still scans. */
	export function fitsCentredQrCode(value: string): boolean {
		return bytes(value) <= QR_MAX_LENGTH_CENTRED;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { QrCode } from '@ark-ui/svelte/qr-code';

	interface Props {
		value: string;
		/** Accessible name, e.g. "QR code for the Storm Front script". */
		label: string;
		/**
		 * Drawn in the middle (e.g. a script's logo), on the code's light colour. The code then
		 * uses the highest error correction, which recovers about 30% of it, and the middle
		 * covers well under that; values too long for it are drawn without the middle.
		 */
		center?: Snippet;
		/** `wide` for a line of text such as a name; `square` (the default) for a picture. */
		centerShape?: 'square' | 'wide';
		/**
		 * A short warning across the bottom edge, in the quiet zone so it never covers the code
		 * (Trevor, 2026-10-19: the view-only grimoire link says it shows spoilers).
		 */
		caption?: string;
	}

	let { value, label, center, centerShape = 'square', caption }: Props = $props();
	const centred = $derived(!!center && fitsCentredQrCode(value));
</script>

<!-- Dark on light whatever the theme, with a quiet zone, so phone cameras read it. -->
<QrCode.Root
	{value}
	encoding={{ ecc: centred ? 'H' : 'L' }}
	class="qr"
	role="img"
	aria-label={label}
>
	<QrCode.Frame>
		<QrCode.Pattern />
	</QrCode.Frame>
	{#if centred && center}
		<QrCode.Overlay class="qr-center {centerShape}" data-testid="qr-center"
			>{@render center()}</QrCode.Overlay
		>
	{/if}
	{#if caption}<span class="qr-caption" data-testid="qr-caption">{caption}</span>{/if}
</QrCode.Root>

<style>
	:global(.qr[data-scope='qr-code']) {
		box-sizing: border-box;
		width: 100%;
		aspect-ratio: 1;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--token-face);
		color: var(--on-token);
	}
	:global(.qr[data-scope='qr-code']:has(.qr-caption)) {
		position: relative;
		/* Room below for the caption's lower half. */
		margin-bottom: 0.8em;
	}
	.qr-caption {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, 50%);
		padding: 0.1em 0.7em;
		border-radius: var(--radius-sm);
		background: var(--evil);
		color: var(--on-evil);
		font-weight: 700;
		line-height: 1.4;
		white-space: nowrap;
	}
	:global(.qr [data-part='frame']) {
		display: block;
		width: 100%;
		height: 100%;
	}
	:global(.qr [data-part='pattern']) {
		fill: currentColor;
	}
	/* A logo 30% wide (Trevor, 2026-10-19: logos should be expressive). Opaque middles stop
	   scanning at about 42% wide in sharp images, but small or blurry codes on a phone camera
	   started failing past 30% (32%: half as often; 36%: a quarter). The name's wide box
	   stays under 7% of the area: text lost scans even at the logo's 30%. */
	:global(.qr .qr-center[data-part='overlay']) {
		box-sizing: border-box;
		display: grid;
		place-items: center;
		width: 30%;
		height: 30%;
		padding: 1.5%;
		border-radius: var(--radius-sm);
		background: var(--token-face);
		overflow: hidden;
		container-type: size;
	}
	:global(.qr .qr-center.wide[data-part='overlay']) {
		width: 48%;
		height: 14%;
	}
</style>
