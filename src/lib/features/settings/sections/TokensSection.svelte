<script lang="ts">
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import FontPreview from './FontPreview.svelte';
</script>

<!-- Tokens (Trevor, 2026-10-18: split from Board): one box each for the character token, the
     reminder token, and names and reminders in text. -->
<TokenAppearanceSettings
	value={preferences.current.tokenAppearance}
	theme={preferences.theme}
	onChange={(tokenAppearance) => preferences.update({ tokenAppearance })}
>
	{#snippet characterFont()}
		<FontPreview roles={['character']} testid="character-font" />
	{/snippet}
	{#snippet playerFont()}
		<FontPreview roles={['player']} testid="player-font" />
	{/snippet}
	{#snippet reminderFont()}
		<FontPreview roles={['reminder']} testid="reminder-font" />
	{/snippet}
</TokenAppearanceSettings>
