<script lang="ts">
	import { ambienceOptions, type AmbienceScene } from '#lib/core/sound/ambience.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { AMBIENCE_LEVEL, DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { previewAmbience } from './ambience.ts';

	const off = $derived(!preferences.current.ambienceOn);
	const key = { night: 'nightAmbience', day: 'dayAmbience' } as const;

	function choose(scene: AmbienceScene, id: string) {
		preferences.update({ [key[scene]]: id });
		void previewAmbience(id);
	}

	/** Plays the night's recording once the level slider rests, so the new level can be heard. */
	let hearLevel: ReturnType<typeof setTimeout> | undefined;
	function setLevel(ambienceLevel: number) {
		preferences.update({ ambienceLevel });
		clearTimeout(hearLevel);
		hearLevel = setTimeout(() => void previewAmbience(preferences.current.nightAmbience), 300);
	}
</script>

<!-- Day and night sound in the room (plan U3, Trevor 2026-10-26): one recording for the night
     and one for the day. Every row stays in place, disabled while it is off. -->
<SettingHeading title={t('settings.ambience')} />
<SettingToggle
	label={t('settings.ambienceOn')}
	checked={preferences.current.ambienceOn}
	onChange={(ambienceOn) => preferences.update({ ambienceOn })}
/>
<SettingSlider
	label={t('settings.ambienceLevel')}
	value={preferences.current.ambienceLevel}
	min={AMBIENCE_LEVEL.min}
	max={AMBIENCE_LEVEL.max}
	step={AMBIENCE_LEVEL.step}
	defaultValue={DEFAULT_PREFERENCES.ambienceLevel}
	disabled={off}
	onChange={setLevel}
/>
{#each ['night', 'day'] as const as scene (scene)}
	<SettingSelect
		label={t(`settings.ambienceScene.${scene}`)}
		value={preferences.current[key[scene]]}
		options={ambienceOptions(scene).map((mix) => ({
			value: mix.id,
			label: mix.name,
			description: mix.place
		}))}
		defaultValue={DEFAULT_PREFERENCES[key[scene]]}
		disabled={off}
		onChange={(id) => choose(scene, id)}
	/>
{/each}
