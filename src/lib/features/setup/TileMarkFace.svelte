<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
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

<!--
	A face-down tile's mark; the tile button carries its name in words. A colour fills the
	whole tile (the draw page paints it), so only a repeat number shows here.
-->
<span class="mark" data-kind={mark.kind} aria-hidden="true">
	{#if mark.kind === 'text'}{mark.text}
	{:else if mark.kind === 'emoji'}<span class="emoji">{mark.emoji}</span>
	{:else if mark.kind === 'symbol'}<IconGlyph id={withWeight(mark.icon, weight)} {set} />
	{:else if mark.kind === 'player'}<PlayerBadge name={mark.name} />
	{/if}
	{#if mark.kind !== 'text' && mark.kind !== 'player' && mark.repeat}<span class="repeat"
			>{mark.repeat}</span
		>{/if}
</span>

<style>
	.mark {
		position: relative;
		display: grid;
		place-items: center;
	}
	.mark[data-kind='symbol'] :global(.icon) {
		--icon-size: 1.6em;
		display: block;
	}
	/* A name fills the tile's width, at the size of a name under a seat. */
	.mark[data-kind='player'] {
		width: 85%;
		font-size: 0.45em;
		font-weight: normal;
	}
	.emoji {
		font-size: 1.2em;
		line-height: 1;
	}
	.repeat {
		position: absolute;
		inset-inline-end: -0.6em;
		inset-block-end: -0.3em;
		font-size: 0.4em;
	}
</style>
