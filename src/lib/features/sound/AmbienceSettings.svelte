<script lang="ts">
	import {
		AMBIENCE_SCENES,
		AMBIENCE_SOUNDS,
		ambienceChoices,
		type AmbienceChoice,
		type AmbienceSound
	} from '#lib/core/sound/ambience.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { AMBIENCE_LEVEL, DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingCollapsible from '#lib/ui/settings/SettingCollapsible.svelte';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { previewAmbience } from './ambience.ts';

	const off = $derived(!preferences.current.ambienceOn);

	type NameKey = Extract<MessageKey, `settings.ambienceSound.${string}`>;
	function nameOf(sound: AmbienceSound): string {
		return t(`settings.ambienceSound.${sound.id}` as NameKey);
	}

	function choose(sound: AmbienceSound, choice: AmbienceChoice) {
		preferences.update({ ambience: { ...preferences.current.ambience, [sound.id]: choice } });
		if (choice !== 'off') void previewAmbience(sound.id);
	}

	/** Plays a call once the level slider rests, so the new level can be heard. */
	let hearLevel: ReturnType<typeof setTimeout> | undefined;
	function setLevel(ambienceLevel: number) {
		preferences.update({ ambienceLevel });
		clearTimeout(hearLevel);
		hearLevel = setTimeout(() => void previewAmbience('owl'), 300);
	}
</script>

<!-- Day and night sound on the board (plan U3, Trevor 2026-10-26): which recordings play and
     how often each call comes. Every row stays in place, disabled while it is off. -->
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
{#each AMBIENCE_SCENES as scene (scene)}
	{@const sounds = AMBIENCE_SOUNDS.filter((sound) => sound.scene === scene)}
	<SettingCollapsible
		title={t(`settings.ambienceScene.${scene}`)}
		storageKey="settings.ambience.{scene}"
		defaultOpen={false}
		count={sounds.length}
	>
		{#each sounds as sound (sound.id)}
			{@const choice = preferences.current.ambience[sound.id] ?? sound.choice}
			{#if sound.kind === 'loop'}
				<SettingToggle
					label={nameOf(sound)}
					checked={choice === 'on'}
					disabled={off}
					onChange={(on) => choose(sound, on ? 'on' : 'off')}
				/>
			{:else}
				<SettingSelect
					label={nameOf(sound)}
					value={choice}
					options={ambienceChoices(sound).map((value) => ({
						value,
						label: t(`settings.ambienceChoice.${value}`)
					}))}
					defaultValue={sound.choice}
					disabled={off}
					onChange={(value) => choose(sound, value)}
				/>
			{/if}
		{/each}
	</SettingCollapsible>
{/each}
