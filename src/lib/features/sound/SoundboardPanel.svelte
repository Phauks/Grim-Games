<script lang="ts">
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { soundOptions } from './sound-names.svelte.ts';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * The pane's Sounds, under More (Trevor, 2026-11-19, D: "i don't think we need all these
	 * sounds in this manner"): one sound picked from a drop-down, Play (Stop while it plays) and
	 * Pause, then day and night sound on or off. The moments of a game play their own sounds,
	 * set in Settings > Sound, so this is for a sound the Storyteller wants now.
	 */

	let chosen = $state(BOARD_SOUNDS[0].id);
	const playing = $derived(soundboard.isPlaying(chosen) && !soundboard.paused);
	const pausable = $derived(
		soundboard.paused ||
			soundboard.playing !== undefined ||
			(preferences.current.ambienceOn && preferences.current.soundVolume > 0)
	);
</script>

<div class="sounds" data-testid="pane-sounds">
	<div class="row">
		<div class="pick">
			<Select
				label={t('settings.soundChoice')}
				hideLabel
				value={chosen}
				options={soundOptions(false)}
				onChange={(id) => (chosen = id)}
			/>
		</div>
		<IconButton
			outlined
			icon={playing ? 'soundStop' : 'soundPlay'}
			label={playing ? t('settings.soundStop') : t('settings.soundPlay')}
			onclick={() => soundboard.toggle(chosen)}
		/>
		<IconButton
			outlined
			icon={soundboard.paused ? 'soundResume' : 'soundPause'}
			label={soundboard.paused ? t('settings.soundResume') : t('settings.soundPause')}
			disabled={!pausable}
			onclick={() => (soundboard.paused ? soundboard.resume() : soundboard.pause())}
		/>
	</div>
	<SettingToggle
		label={t('settings.ambience')}
		checked={preferences.current.ambienceOn}
		onChange={(ambienceOn) => preferences.update({ ambienceOn })}
	/>
</div>

<style>
	.sounds {
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
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.pick {
		flex: 1;
		min-width: 0;
	}
</style>
