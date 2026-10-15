<script lang="ts">
	import { onMount } from 'svelte';
	import { FONT_IDS, loadFont, type FontId } from '#lib/ui/fonts/catalogue.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveFonts } from '#lib/ui/preferences.ts';
	import FontPicker from '../FontPicker.svelte';

	const theme = $derived(preferences.theme);
	const fonts = $derived(resolveFonts(preferences.current, theme));

	// The previews need every offered font; elsewhere only the chosen ones are fetched.
	onMount(() => FONT_IDS.forEach(loadFont));

	function choose(role: 'display' | 'text', font: FontId) {
		const value = font === theme.fonts[role] ? null : font;
		preferences.update(role === 'display' ? { displayFont: value } : { textFont: value });
	}
</script>

<FontPicker
	role="display"
	label="Titles and character names"
	sample="Washerwoman"
	value={fonts.display}
	onChange={(font) => choose('display', font)}
/>
<FontPicker
	role="text"
	label="Everything else"
	description="Atkinson Hyperlegible Next and Lexend are designed for easy reading."
	sample="Alex nominates Sam."
	value={fonts.text}
	onChange={(font) => choose('text', font)}
/>
