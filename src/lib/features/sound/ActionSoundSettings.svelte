<script lang="ts">
	import { BOARD_SOUNDS, SOUND_ACTIONS, type SoundAction } from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { soundboard } from './soundboard.svelte.ts';

	const off = $derived(!preferences.current.actionSoundsOn);
	const options = [
		{ value: 'none', label: t('settings.actionSoundNone') },
		...BOARD_SOUNDS.map((sound) => ({ value: sound.id, label: sound.name }))
	];

	function choose(action: SoundAction, sound: string) {
		preferences.update({ actionSounds: { ...preferences.current.actionSounds, [action]: sound } });
		if (sound !== 'none') void soundboard.play(sound);
	}
</script>

<!-- Sounds tied to the Storyteller's actions (plan U7, Trevor 2026-10-26). Every row stays in
     place, disabled while it is off. -->
<SettingHeading title={t('settings.actionSounds')} />
<SettingToggle
	label={t('settings.actionSoundsOn')}
	checked={preferences.current.actionSoundsOn}
	onChange={(actionSoundsOn) => preferences.update({ actionSoundsOn })}
/>
{#each SOUND_ACTIONS as action (action)}
	<SettingSelect
		label={t(`settings.actionSound.${action}`)}
		value={preferences.current.actionSounds[action]}
		{options}
		defaultValue={DEFAULT_PREFERENCES.actionSounds[action]}
		disabled={off}
		onChange={(sound) => choose(action, sound)}
	/>
{/each}
