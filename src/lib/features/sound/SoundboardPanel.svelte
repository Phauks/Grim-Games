<script lang="ts">
	import { padId, padName, padSounds } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { hold } from '#lib/ui/hold.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import { soundboard } from './soundboard.svelte.ts';
	import SoundboardSettings from './SoundboardSettings.svelte';
	import SoundPadsDialog from './SoundPadsDialog.svelte';

	/**
	 * The Storyteller's soundboard (plan U6, Trevor 2026-10-26): a tap plays a bell or another
	 * sound at once, and a second tap stops it. Day and night sound is beside it, so the
	 * recording can change mid-game. Pause, above the pads, holds both where they are (Trevor,
	 * 2026-10-27); it stays in place, disabled, while nothing plays. The mixer is below the
	 * pads; holding a pad picks it there. The pads are the sounds and mixes the Storyteller
	 * placed (Trevor, 2026-10-27: "hot spots"); "+ New" and Edit open SoundPadsDialog.
	 * In the Storyteller's pane, under More (Trevor, 2026-11-18): its two buttons on a row, then
	 * the pads, then the controls, in one scroll.
	 */

	let padsOpen = $state(false);

	const pausable = $derived(
		soundboard.paused ||
			soundboard.playing.length > 0 ||
			(preferences.current.ambienceOn && preferences.current.soundVolume > 0)
	);
</script>

<div class="soundboard" data-testid="pane-sounds">
	<div class="actions">
		<IconButton icon="edit" label={t('settings.soundPads')} onclick={() => (padsOpen = true)} />
		<IconButton
			icon={soundboard.paused ? 'soundResume' : 'soundPause'}
			label={soundboard.paused ? t('settings.soundResume') : t('settings.soundPause')}
			disabled={!pausable}
			onclick={() => (soundboard.paused ? soundboard.resume() : soundboard.pause())}
		/>
	</div>
	<div class="pads" role="group" aria-label={t('settings.soundboard')}>
		{#each preferences.current.soundPads as pad (padId(pad))}
			<Chip
				pressed={soundboard.isPadPlaying(pad)}
				onclick={() => soundboard.togglePad(pad)}
				{@attach hold(() => (soundboard.mixing = padSounds(pad)[0]))}
			>
				{padName(pad)}
			</Chip>
		{/each}
		<Chip class="new" aria-label={t('settings.soundPadNewLabel')} onclick={() => (padsOpen = true)}>
			<Icon name="add" />{t('settings.soundPadNew')}
		</Chip>
	</div>
	<SoundboardSettings master />
	<AmbienceSettings />
</div>
<SoundPadsDialog bind:open={padsOpen} />

<style>
	.soundboard {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		flex: 1;
		min-height: 0;
		padding-inline: var(--pane-gutter, 0rem);
		overflow-y: auto;
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-1);
	}
	.pads {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: var(--space-2);
	}
	/* The "+ New" pad: a dashed outline, like every new-item card. */
	.pads :global(.new) {
		border-style: dashed;
	}
</style>
