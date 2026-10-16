<script lang="ts">
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
</script>

<TokenAppearanceSettings
	value={preferences.current.tokenAppearance}
	theme={preferences.theme}
	onChange={(tokenAppearance) => preferences.update({ tokenAppearance })}
/>
