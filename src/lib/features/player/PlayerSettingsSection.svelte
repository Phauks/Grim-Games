<script lang="ts">
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
</script>

<SettingToggle
	label="Hide note contents"
	description="In the player view, the Notes tab shows each note's title but hides its text until you open it, so nobody glancing at your phone can read it."
	checked={playerSettings.current.hideNoteContents}
	onChange={(hideNoteContents) => playerSettings.update({ hideNoteContents })}
/>
