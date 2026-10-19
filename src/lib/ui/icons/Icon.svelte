<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveIcon, resolveIconBase, resolveIconSet } from '#lib/ui/preferences.ts';
	import { withWeight, type IconSlot, type PhosphorWeight } from './catalogue.ts';
	import IconGlyph from './IconGlyph.svelte';

	interface Props {
		/** The concept to draw; the theme and the user's choices decide the actual icon. */
		name: IconSlot;
		/** Accessible name; leave it out when a visible label sits next to the icon. */
		label?: string;
		/** A weight that carries meaning (solid vs outline), drawn whatever the user's icon set. */
		weight?: PhosphorWeight;
	}

	let { name, label, weight }: Props = $props();

	const id = $derived(
		weight
			? withWeight(resolveIconBase(name, preferences.current, preferences.theme), weight)
			: resolveIcon(name, preferences.current, preferences.theme)
	);
	const set = $derived(
		weight ? (`ph-${weight}` as const) : resolveIconSet(preferences.current, preferences.theme)
	);
</script>

<IconGlyph {id} {set} {label} />
