<script lang="ts">
	import { padId, padName, padSounds } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { hold } from '#lib/ui/hold.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import { soundboard } from './soundboard.svelte.ts';
	import SoundboardSettings from './SoundboardSettings.svelte';
	import SoundPadsDialog from './SoundPadsDialog.svelte';

	/**
	 * The Storyteller's soundboard (plan U6, Trevor 2026-10-26): a tap plays a bell or another
	 * sound at once, and a second tap stops it. Day and night sound is beside it, so the
	 * recording can change mid-game. Pause in the header holds both where they are (Trevor,
	 * 2026-10-27); it stays in place, disabled, while nothing plays. The mixer is below the
	 * pads; holding a pad picks it there. The pads are the sounds and mixes the Storyteller
	 * placed (Trevor, 2026-10-27: "hot spots"); "+ New" and Edit open SoundPadsDialog.
	 * A two-pane modal (Trevor, 2026-10-27: "noise controls on one side and the noises on the
	 * other"): the pads on the left, or held on top on a phone, and the controls beside them.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Play on (plan U10): the soundboard reaches the Public Town through this board's room.
	$effect(() => {
		if (!roomHost().code) return;
		soundboard.town = (command) => roomHost().townSound(command);
		return () => (soundboard.town = undefined);
	});

	// Levels and loops follow the mixer while sounds play, from here or from Settings.
	$effect(() => {
		void preferences.current.soundVolume;
		void preferences.current.soundboardLevel;
		void preferences.current.soundMixes;
		void preferences.current.soundOutput;
		soundboard.applyMix();
	});

	let padsOpen = $state(false);

	const pausable = $derived(
		soundboard.paused ||
			soundboard.playing.length > 0 ||
			(preferences.current.ambienceOn && preferences.current.soundVolume > 0)
	);
</script>

<Dialog bind:open title={t('settings.soundboard')}>
	{#snippet headActions()}
		<IconButton icon="edit" label={t('settings.soundPads')} onclick={() => (padsOpen = true)} />
		<IconButton
			icon={soundboard.paused ? 'soundResume' : 'soundPause'}
			label={soundboard.paused ? t('settings.soundResume') : t('settings.soundPause')}
			disabled={!pausable}
			onclick={() => (soundboard.paused ? soundboard.resume() : soundboard.pause())}
		/>
	{/snippet}
	{#snippet aside()}
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
			<Chip
				class="new"
				aria-label={t('settings.soundPadNewLabel')}
				onclick={() => (padsOpen = true)}
			>
				<Icon name="add" />{t('settings.soundPadNew')}
			</Chip>
		</div>
	{/snippet}
	<SoundboardSettings master />
	<AmbienceSettings />
</Dialog>
<SoundPadsDialog bind:open={padsOpen} />

<style>
	.pads {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: var(--space-2);
	}
	/* Held on top on a phone: many pads scroll in their own part, so the controls stay in view. */
	@container dialog-panes (max-width: 36rem) {
		.pads {
			max-height: 35dvh;
			overflow-y: auto;
			overscroll-behavior: contain;
		}
	}
	/* The "+ New" pad: a dashed outline, like every new-item card. */
	.pads :global(.new) {
		border-style: dashed;
	}
</style>
