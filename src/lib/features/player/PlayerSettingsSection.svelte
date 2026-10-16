<script lang="ts">
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
</script>

<SettingToggle
	label="Hide note contents"
	description="In the player view, the Notes tab hides each note's title and text until you open it, so nobody glancing at your phone can read them."
	checked={playerSettings.current.hideNoteContents}
	onChange={(hideNoteContents) => playerSettings.update({ hideNoteContents })}
/>
