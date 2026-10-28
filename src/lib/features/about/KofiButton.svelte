<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { KOFI_URL } from './support.ts';
</script>

<!--
	Ko-fi's own ready-made "Support me on Ko-fi" button, not one of ours (Trevor, 2026-10-28:
	"should use actual Kofi assets"). Ko-fi's brand assets page offers these images "to link to
	your page" (more.ko-fi.com/brand-assets, Buttons). static/brand/support-me-on-kofi-blue.png
	is storage.ko-fi.com/cdn/brandasset/v2/support_me_on_kofi_blue.png, unchanged: the blue one,
	Ko-fi's brand blue with dark text, which stands out on the app's dark theme.
	In place but faded until there is a link, so nothing moves when it arrives.
-->
{#if KOFI_URL}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an https address -->
	<a class="kofi" href={KOFI_URL} target="_blank" rel="noopener noreferrer">
		<img
			src="/brand/support-me-on-kofi-blue.png"
			width="980"
			height="198"
			alt={t('shell.supportKofi')}
		/>
	</a>
{:else}
	<span class="kofi" aria-disabled="true">
		<img
			src="/brand/support-me-on-kofi-blue.png"
			width="980"
			height="198"
			alt={t('shell.supportKofi')}
		/>
	</span>
{/if}

<style>
	.kofi {
		display: inline-flex;
		border-radius: var(--button-radius);
	}
	.kofi[aria-disabled='true'] {
		opacity: 0.5;
	}
	a.kofi:hover {
		filter: brightness(1.1);
	}
	a.kofi:active {
		transform: translateY(1px);
	}
	/* Taller than the 44px tap minimum at every text size; the width follows the image. */
	img {
		display: block;
		width: auto;
		height: max(var(--tap-target), calc(3 * var(--u)));
	}
</style>
