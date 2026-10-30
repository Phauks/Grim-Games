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
	import { encode } from 'uqr';
	import { qrCentreBox } from './qr-centre.ts';
	import { qrPath, type QrFinderShape, type QrModuleShape } from './qr-pattern.ts';

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
		/** The squares' shape and the corner markers' (Trevor, 2026-10-23); square by default. */
		modules?: QrModuleShape;
		finders?: QrFinderShape;
	}

	let {
		value,
		label,
		center,
		centerShape = 'square',
		caption,
		modules = 'square',
		finders = 'square'
	}: Props = $props();
	const centred = $derived(!!center && fitsCentredQrCode(value));
	const ecc = $derived(centred ? 'H' : 'L');
	/**
	 * The middle in whole modules (Trevor, 2026-10-23: the logo's backing ends exactly on the
	 * squares' lines). The same encoder as the drawn code, so the module count matches.
	 */
	// The same encoder and options as Ark's, so this matrix is the one its frame is sized to.
	const matrix = $derived(encode(value, { ecc }));
	const pattern = $derived(qrPath(matrix, modules, finders));
	const box = $derived.by(() => {
		if (!centred) return undefined;
		const size = matrix.size;
		return {
			modules: size,
			...(centerShape === 'wide' ? qrCentreBox(size, 0.48, 0.14) : qrCentreBox(size, 0.3))
		};
	});
</script>

<!-- Dark on light whatever the theme, with a quiet zone, so phone cameras read it. -->
<QrCode.Root {value} encoding={{ ecc }} pixelSize={1} class="qr" role="img" aria-label={label}>
	<QrCode.Frame
		shape-rendering={modules === 'square' && finders === 'square'
			? 'crispEdges'
			: 'geometricPrecision'}
	>
		<!-- Our own drawing of the matrix, for the shapes; Ark's draws squares only. -->
		<path class="qr-pattern" data-testid="qr-pattern" d={pattern} fill-rule="evenodd" />
		<!-- The picture's backing, on the code's own grid, so it covers whole squares only. -->
		{#if box}<rect
				class="qr-backing"
				data-testid="qr-backing"
				x={box.x}
				y={box.y}
				width={box.width}
				height={box.height}
			/>{/if}
	</QrCode.Frame>
	{#if box && center}
		<QrCode.Overlay
			class="qr-center {centerShape}"
			data-testid="qr-center"
			style="--qr-span-x: {box.width / box.modules}; --qr-span-y: {box.height / box.modules}"
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
		/* Room below for the caption's lower half; a caller that keeps it anyway sets 0. */
		margin-bottom: var(--qr-caption-room, 0.8em);
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
	.qr-pattern {
		fill: currentColor;
	}
	/* A logo 30% wide (Trevor, 2026-10-19: logos should be expressive). Opaque middles stop
	   scanning at about 42% wide in sharp images, but small or blurry codes on a phone camera
	   started failing past 30% (32%: half as often; 36%: a quarter). The name's wide box
	   stays under 7% of the area: text lost scans even at the logo's 30%. The share is of the
	   code's modules, rounded down to whole ones (qr-centre.ts), and the backing is drawn in
	   the code itself; the picture sits on it, over exactly the same squares. */
	.qr-backing {
		fill: var(--token-face);
	}
	:global(.qr .qr-center[data-part='overlay']) {
		box-sizing: border-box;
		display: grid;
		place-items: center;
		/* The frame is the root less its padding (the quiet zone) on each side. */
		width: calc((100% - 2 * var(--space-3)) * var(--qr-span-x));
		height: calc((100% - 2 * var(--space-3)) * var(--qr-span-y));
		padding: 1.5%;
		overflow: hidden;
		container-type: size;
	}
</style>
