<script lang="ts">
	import type { IconSetId } from './catalogue.ts';
	import { iconSets } from './sets.svelte.ts';

	interface Props {
		/** Full Iconify id in the set's weight, e.g. `ph:skull-fill`. */
		id: string;
		set: IconSetId;
		/** Accessible name; without one the icon is decorative. */
		label?: string;
	}

	let { id, set, label }: Props = $props();

	$effect(() => iconSets.load(set, id));

	const Glyph = $derived(iconSets.get(set)?.[id]);
</script>

<span
	class="icon"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-icon={id}
>
	{#if Glyph}
		<Glyph width="100%" height="100%" />
	{/if}
</span>

<style>
	.icon {
		display: inline-block;
		flex: none;
		/* --icon-size is the design size; --icon-scale is the user's Icon size setting. */
		width: calc(var(--icon-size) * var(--icon-scale, 1));
		height: calc(var(--icon-size) * var(--icon-scale, 1));
		line-height: 0;
		vertical-align: middle;
	}
</style>
