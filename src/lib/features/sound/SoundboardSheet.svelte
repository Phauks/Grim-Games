<script lang="ts">
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * The Storyteller's soundboard (plan U6, Trevor 2026-10-26): a tap plays a bell or another
	 * sound at once, and a second tap stops it. Day and night sound is beside it, so the
	 * recording can change mid-game.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<BottomSheet bind:open title={t('settings.soundboard')}>
	<div class="pads" role="group" aria-label={t('settings.soundboard')}>
		{#each BOARD_SOUNDS as sound (sound.id)}
			<Chip pressed={soundboard.playing === sound.id} onclick={() => soundboard.toggle(sound.id)}>
				{sound.name}
			</Chip>
		{/each}
	</div>
	<AmbienceSettings />
</BottomSheet>

<style>
	.pads {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding-block: var(--space-2) var(--space-4);
	}
</style>
