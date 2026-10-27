<script lang="ts">
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * The Storyteller's soundboard (plan U6, Trevor 2026-10-26): a tap plays a bell or another
	 * sound at once, and a second tap stops it. Day and night sound is beside it, so the
	 * recording can change mid-game. Pause in the header holds both where they are (Trevor,
	 * 2026-10-27); it stays in place, disabled, while nothing plays.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	const pausable = $derived(
		soundboard.paused ||
			soundboard.playing !== undefined ||
			(preferences.current.ambienceOn && preferences.current.soundVolume > 0)
	);
</script>

<BottomSheet bind:open title={t('settings.soundboard')}>
	{#snippet actions()}
		<IconButton
			icon={soundboard.paused ? 'soundResume' : 'soundPause'}
			label={soundboard.paused ? t('settings.soundResume') : t('settings.soundPause')}
			disabled={!pausable}
			onclick={() => (soundboard.paused ? soundboard.resume() : soundboard.pause())}
		/>
	{/snippet}
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
