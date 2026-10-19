<script lang="ts">
	import ScriptLogo from './ScriptLogo.svelte';

	/**
	 * The middle of a script's QR code (Trevor, 2026-10-19): the script's logo, or without one
	 * (or if it fails to load) the script's name in the headings font. Used by every share of
	 * a script or a game on it; the caller passes `qrCenterShape` to SharePanel from `failed`:
	 * 'square' while the logo shows, else 'wide'.
	 */
	interface Props {
		logo: string | undefined;
		name: string;
		/** True once the logo's link has failed, so the name shows instead. */
		failed?: boolean;
	}

	let { logo, name, failed = $bindable(false) }: Props = $props();
	$effect(() => {
		void logo;
		failed = false;
	});
</script>

<span class="center">
	{#if logo && !failed}
		<ScriptLogo src={logo} class="qr-logo" onfail={() => (failed = true)} />
	{:else}
		<span class="qr-name" data-testid="qr-name">{name}</span>
	{/if}
</span>

<style>
	.center {
		display: contents;
	}
	.center :global(.qr-logo) {
		width: 100%;
		height: 100%;
	}
	/* Sized by the middle's own height, at most two lines. */
	.qr-name {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		color: var(--on-token);
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 34cqh;
		line-height: 1.1;
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>
