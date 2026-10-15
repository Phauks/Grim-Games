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

	$effect(() => iconSets.load(set));

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
		width: var(--icon-size);
		height: var(--icon-size);
		line-height: 0;
		vertical-align: middle;
	}
</style>
