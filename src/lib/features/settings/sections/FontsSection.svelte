<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FONT_IDS,
		FONT_ROLES,
		loadFont,
		type FontId,
		type FontRole
	} from '#lib/ui/fonts/catalogue.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveFonts } from '#lib/ui/preferences.ts';
	import FontPicker from '../FontPicker.svelte';

	const theme = $derived(preferences.theme);
	const fonts = $derived(resolveFonts(preferences.current, theme));

	// The dropdowns draw every offered font; elsewhere only the chosen ones are fetched.
	onMount(() => FONT_IDS.forEach(loadFont));

	function choose(role: FontRole, font: FontId) {
		const next = { ...preferences.current.fonts, [role]: font };
		// Picking the theme's own font clears the override, so a theme change still applies.
		if (font === theme.fonts[role]) delete next[role];
		preferences.update({ fonts: next });
	}
</script>

{#each FONT_ROLES as role (role)}
	<FontPicker
		{role}
		value={fonts[role]}
		defaultValue={theme.fonts[role]}
		onChange={(font) => choose(role, font)}
	/>
{/each}
