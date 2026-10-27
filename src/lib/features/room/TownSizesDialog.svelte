<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import TextSizeRows from '#lib/features/settings/sections/TextSizeRows.svelte';
	import PlayerSizeRows from '#lib/features/player/PlayerSizeRows.svelte';

	/**
	 * The Public Town's text and token sizes, from its settings cog (Trevor, 2026-10-27: "same
	 * font and token size controls as player view. Probably just same component"): Text size,
	 * Pinch to zoom and the player screen's sizes, the same rows and saved values as the
	 * player's cog.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog bind:open title={t('player.sizes')}>
	<div class="rows"><TextSizeRows /><PlayerSizeRows /></div>
</Dialog>

<style>
	.rows {
		display: grid;
		min-width: 0;
	}
</style>
