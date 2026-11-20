<script lang="ts">
	import type { SoundMoment } from '#lib/core/sound/soundboard.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { momentName, soundOptions } from './sound-names.svelte.ts';
	import { previewSound } from './soundboard.svelte.ts';

	/**
	 * The sound one moment of a game plays by itself, or None (Trevor, 2026-11-19): in Settings >
	 * Sound, and the timer's on the day timer's sheets too. In Settings a choice plays on this
	 * device, so it can be heard; over the board it doesn't, the board being the Storyteller's
	 * device (Trevor, 2026-10-30).
	 */
	let {
		moment,
		disabled = false,
		preview = true
	}: { moment: SoundMoment; disabled?: boolean; preview?: boolean } = $props();

	function choose(sound: string) {
		preferences.update({
			momentSounds: { ...preferences.current.momentSounds, [moment]: sound }
		});
		if (preview && sound !== 'none') previewSound(sound);
	}
</script>

<SettingSelect
	label={momentName(moment)}
	value={preferences.current.momentSounds[moment]}
	options={soundOptions(true)}
	defaultValue={DEFAULT_PREFERENCES.momentSounds[moment]}
	{disabled}
	onChange={choose}
/>
