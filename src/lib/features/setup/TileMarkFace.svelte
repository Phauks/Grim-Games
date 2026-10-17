<script lang="ts">
	import IconGlyph from '#lib/ui/icons/IconGlyph.svelte';
	import { ICON_SETS, withWeight } from '#lib/ui/icons/catalogue.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveIconSet } from '#lib/ui/preferences.ts';
	import type { TileMark } from './tile-face.ts';

	interface Props {
		mark: TileMark;
	}

	let { mark }: Props = $props();

	const set = $derived(resolveIconSet(preferences.current, preferences.theme));
	const weight = $derived(ICON_SETS.find((s) => s.id === set)?.weight ?? 'regular');
</script>

<!-- A face-down tile's mark; the tile button carries its name in words. -->
<span class="mark" data-kind={mark.kind} aria-hidden="true">
	{#if mark.kind === 'text'}{mark.text}
	{:else if mark.kind === 'symbol'}<IconGlyph id={withWeight(mark.icon, weight)} {set} />
	{:else}<span class="swatch" style:background={mark.colour}></span>
	{/if}
	{#if mark.kind !== 'text' && mark.repeat}<span class="repeat">{mark.repeat}</span>{/if}
</span>

<style>
	.mark {
		position: relative;
		display: grid;
		place-items: center;
	}
	.mark[data-kind='symbol'] :global(.icon) {
		--icon-size: 1.4em;
	}
	.swatch {
		width: 1.3em;
		height: 1.3em;
		border-radius: 50%;
		box-shadow:
			0 0 0 0.08em var(--token-face, currentColor),
			0 0 0 0.14em currentColor;
	}
	.repeat {
		position: absolute;
		inset-inline-end: -0.6em;
		inset-block-end: -0.3em;
		font-size: 0.4em;
	}
</style>
