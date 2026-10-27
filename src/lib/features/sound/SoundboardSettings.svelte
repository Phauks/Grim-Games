<script lang="ts">
	import {
		BOARD_SOUNDS,
		DEFAULT_SOUND_MIX,
		SOUND_MIX_VOLUME,
		SOUND_OUTPUTS,
		soundMix,
		type BoardSoundMix
	} from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, SOUND_VOLUME } from '#lib/ui/preferences.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { soundboard } from './soundboard.svelte.ts';
	import SoundPadsDialog from './SoundPadsDialog.svelte';

	/**
	 * The soundboard's mixer (Trevor 2026-10-27: "more mixing controls"), in Settings > Sound
	 * and on the Soundboard sheet: its level, whether sounds overlap, and each sound's own
	 * volume and loop. Holding a pad on the sheet picks that sound here. With `master` the
	 * device's volume leads, for the sheet, where Settings' own Volume row isn't.
	 */
	let { master = false }: { master?: boolean } = $props();

	let padsOpen = $state(false);

	const mix = $derived(soundMix(preferences.current.soundMixes, soundboard.mixing));

	function setMix(change: Partial<BoardSoundMix>) {
		const next = { ...mix, ...change };
		const soundMixes = { ...preferences.current.soundMixes };
		if (next.volume === DEFAULT_SOUND_MIX.volume && next.loop === DEFAULT_SOUND_MIX.loop) {
			delete soundMixes[soundboard.mixing];
		} else soundMixes[soundboard.mixing] = next;
		preferences.update({ soundMixes });
	}
</script>

<SettingHeading title={t('settings.soundboard')} />
{#if master}
	<SettingSlider
		label={t('settings.soundVolume')}
		value={preferences.current.soundVolume}
		min={SOUND_VOLUME.min}
		max={SOUND_VOLUME.max}
		step={SOUND_VOLUME.step}
		defaultValue={DEFAULT_PREFERENCES.soundVolume}
		onChange={(soundVolume) => preferences.update({ soundVolume })}
	/>
{/if}
{#if !master}
	<!-- Which sounds and mixes the soundboard shows; on the sheet, its own Edit and "+ New". -->
	<SettingRow label={t('settings.soundPadsRow')}>
		{#snippet control(labelId)}
			<Button icon="edit" aria-describedby={labelId} onclick={() => (padsOpen = true)}
				>{t('settings.soundPads')}</Button
			>
		{/snippet}
	</SettingRow>
	<SoundPadsDialog bind:open={padsOpen} />
{/if}
<!-- Where it plays while the board has a room (plan U10); the Public Town plays its own copy. -->
<SettingSelect
	label={t('settings.soundOutput')}
	value={preferences.current.soundOutput}
	options={SOUND_OUTPUTS.map((output) => ({
		value: output,
		label: t(`settings.soundOutput.${output}`)
	}))}
	defaultValue={DEFAULT_PREFERENCES.soundOutput}
	onChange={(soundOutput) => preferences.update({ soundOutput })}
/>
<SettingSlider
	label={t('settings.soundboardLevel')}
	value={preferences.current.soundboardLevel}
	min={SOUND_VOLUME.min}
	max={SOUND_VOLUME.max}
	step={SOUND_VOLUME.step}
	defaultValue={DEFAULT_PREFERENCES.soundboardLevel}
	onChange={(soundboardLevel) => preferences.update({ soundboardLevel })}
/>
<SettingToggle
	label={t('settings.soundboardOverlap')}
	checked={preferences.current.soundboardOverlap}
	onChange={(soundboardOverlap) => preferences.update({ soundboardOverlap })}
/>
<SettingSelect
	label={t('settings.soundMixSound')}
	value={soundboard.mixing}
	options={BOARD_SOUNDS.map((sound) => ({ value: sound.id, label: sound.name }))}
	onChange={(id) => (soundboard.mixing = id)}
/>
<SettingSlider
	label={t('settings.soundMixVolume')}
	value={mix.volume}
	min={SOUND_MIX_VOLUME.min}
	max={SOUND_MIX_VOLUME.max}
	step={SOUND_MIX_VOLUME.step}
	defaultValue={DEFAULT_SOUND_MIX.volume}
	onChange={(volume) => setMix({ volume })}
/>
<SettingToggle
	label={t('settings.soundMixLoop')}
	checked={mix.loop}
	onChange={(loop) => setMix({ loop })}
/>
