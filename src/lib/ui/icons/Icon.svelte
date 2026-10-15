<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveIcon, resolveIconSet } from '#lib/ui/preferences.ts';
	import type { IconSlot } from './catalogue.ts';
	import IconGlyph from './IconGlyph.svelte';

	interface Props {
		/** The concept to draw; the theme and the user's choices decide the actual icon. */
		name: IconSlot;
		/** Accessible name; leave it out when a visible label sits next to the icon. */
		label?: string;
	}

	let { name, label }: Props = $props();

	const id = $derived(resolveIcon(name, preferences.current, preferences.theme));
	const set = $derived(resolveIconSet(preferences.current, preferences.theme));
</script>

<IconGlyph {id} {set} {label} />
