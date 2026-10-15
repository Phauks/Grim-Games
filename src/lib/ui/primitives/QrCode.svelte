<script lang="ts" module>
	/**
	 * The most characters a QR code holds at the lowest error correction (version 40, byte
	 * mode: 2,953 bytes). Longer values are not drawn; check with `fitsQrCode` first.
	 */
	export const QR_MAX_LENGTH = 2900;

	export function fitsQrCode(value: string): boolean {
		return new TextEncoder().encode(value).length <= QR_MAX_LENGTH;
	}
</script>

<script lang="ts">
	import { QrCode } from '@ark-ui/svelte/qr-code';

	interface Props {
		value: string;
		/** Accessible name, e.g. "QR code for the Storm Front script". */
		label: string;
	}

	let { value, label }: Props = $props();
</script>

<!-- Dark on light whatever the theme, with a quiet zone, so phone cameras read it. -->
<QrCode.Root {value} encoding={{ ecc: 'L' }} class="qr" role="img" aria-label={label}>
	<QrCode.Frame>
		<QrCode.Pattern />
	</QrCode.Frame>
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
	:global(.qr [data-part='frame']) {
		display: block;
		width: 100%;
		height: 100%;
	}
	:global(.qr [data-part='pattern']) {
		fill: currentColor;
	}
</style>
