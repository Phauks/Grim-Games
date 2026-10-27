<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { SOUND_VOLUME, TIMER_SOUNDS } from '#lib/ui/preferences.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import ActionSoundSettings from './ActionSoundSettings.svelte';
	import SoundboardSettings from './SoundboardSettings.svelte';
	import AmbienceSettings from './AmbienceSettings.svelte';
	import { playSound } from './sound.ts';
	import VibrateToggle from './VibrateToggle.svelte';

	/**
	 * Plays the timer sound once the volume slider rests, so a drag doesn't restart it every
	 * frame and the new level can be heard.
	 */
	let hearTimer: ReturnType<typeof setTimeout> | undefined;
	function setVolume(soundVolume: number) {
		preferences.update({ soundVolume });
		clearTimeout(hearTimer);
		hearTimer = setTimeout(() => {
			const sound = preferences.current.timerSound;
			playSound(sound === 'none' ? 'bell' : sound);
		}, 300);
	}
</script>

<!-- Every sound in one place (plan U1, Trevor 2026-10-26). The timer's choices are also on the
     timer, where they are used. -->
<SettingSlider
	label={t('settings.soundVolume')}
	value={preferences.current.soundVolume}
	min={SOUND_VOLUME.min}
	max={SOUND_VOLUME.max}
	step={SOUND_VOLUME.step}
	defaultValue={1}
	onChange={setVolume}
/>
<!-- One switch for every alert: the timer running out and a Back to town call. -->
<VibrateToggle />

<SettingHeading title={t('day.timer')} />
<!-- Each choice plays, cutting off the one before (Trevor, 2026-10-17). -->
<SettingSelect
	label={t('day.timerSoundTitle')}
	value={preferences.current.timerSound}
	options={TIMER_SOUNDS.map((sound) => ({ value: sound, label: t(`day.timerSound.${sound}`) }))}
	defaultValue="bell"
	disabled={preferences.current.timerMode === 'up'}
	onChange={(timerSound) => {
		preferences.update({ timerSound });
		playSound(timerSound);
	}}
/>

<!-- What this phone plays when the Storyteller calls Back to town (plan U2). -->
<SettingHeading title={t('room.callTown')} />
<SettingSelect
	label={t('settings.callSound')}
	value={preferences.current.callSound}
	options={TIMER_SOUNDS.map((sound) => ({ value: sound, label: t(`day.timerSound.${sound}`) }))}
	defaultValue="clocktower"
	onChange={(callSound) => {
		preferences.update({ callSound });
		playSound(callSound);
	}}
/>

<AmbienceSettings />

<SoundboardSettings />
<ActionSoundSettings />
