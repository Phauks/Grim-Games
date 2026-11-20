<script lang="ts">
	import { SOUND_MOMENTS, SOUND_OUTPUTS } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, SOUND_VOLUME } from '#lib/ui/preferences.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import CallTownPushToggle from '#lib/features/room/CallTownPushToggle.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import MomentSoundSelect from './MomentSoundSelect.svelte';
	import { previewSound } from './soundboard.svelte.ts';
	import SpeakerSetting from './SpeakerSetting.svelte';
	import StorytellerSoundsToggle from './StorytellerSoundsToggle.svelte';
	import VibrateToggle from './VibrateToggle.svelte';

	/**
	 * Plays the timer's sound once the volume slider rests, so a drag doesn't restart it every
	 * frame and the new level can be heard.
	 */
	let hearVolume: ReturnType<typeof setTimeout> | undefined;
	function setVolume(soundVolume: number) {
		preferences.update({ soundVolume });
		clearTimeout(hearVolume);
		hearVolume = setTimeout(() => previewSound('bell'), 300);
	}
</script>

<!-- Every sound in one place (plan U1; the full sound flow, Trevor 2026-11-19): where and how
     loud they play, then what each moment of a game plays, then day and night sound. -->
<SettingSlider
	label={t('settings.soundVolume')}
	value={preferences.current.soundVolume}
	min={SOUND_VOLUME.min}
	max={SOUND_VOLUME.max}
	step={SOUND_VOLUME.step}
	defaultValue={1}
	onChange={setVolume}
/>
<!-- Whether this phone plays the Storyteller's sounds, as a player answered on joining. -->
<StorytellerSoundsToggle />
<!-- Which speaker every sound plays on (plan U11); Chrome and Edge on a computer only. -->
<SpeakerSetting />
<!-- Which devices in the room play every Storyteller sound (plan U10): never this one (Trevor,
     2026-10-30), so nothing gives away where the Storyteller sits. -->
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
<!-- One switch for every alert: the timer running out and a Back to town call. -->
<VibrateToggle />

<!-- Back to town on a player's phone while it is locked or closed (plan U12). -->
<SettingHeading title={t('room.callTown')} />
<CallTownPushToggle />

<SettingHeading title={t('settings.moments')} />
{#each SOUND_MOMENTS as moment (moment)}
	<MomentSoundSelect
		{moment}
		disabled={moment === 'timeUp' && preferences.current.timerMode === 'up'}
	/>
{/each}

<AmbienceSettings />
