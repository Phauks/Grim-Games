<script lang="ts">
	/*
	 * Character selection's list (Trevor, 2026-10-31: the late player screen uses the same
	 * one, not a copy): the counts, search and tools pinned at the top, then the characters by
	 * type, each type's heading held just beneath the band.
	 */
	import type { Snippet } from 'svelte';
	import type { Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import type { SetupAnalysis } from '#lib/core/rules/index.ts';
	import CharacterPicker, {
		type PickerItemState
	} from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterSearchBox from '#lib/features/characters/CharacterSearchBox.svelte';
	import CountsBar from './CountsBar.svelte';

	interface Props {
		analysis: SetupAnalysis;
		/** Travellers selected. */
		travellers: number;
		travellerLimits?: { min: number; max: number };
		characters: readonly Character[];
		selected: readonly CharacterId[];
		query?: string;
		/** The icon buttons beside the search: Random, Selected only, Clear, or the caller's own. */
		tools: Snippet;
		item: Snippet<[Character, PickerItemState]>;
		groupAside?: Snippet<[CharacterType]>;
		types: readonly CharacterType[];
		keepTypes?: readonly CharacterType[];
		closedTypes?: readonly CharacterType[];
		collapsibleKey: string;
		/** `page`: Character selection's screen. `sheet`: inside a dialog, pinned to its top. */
		surface: 'page' | 'sheet';
		onSelect: (id: CharacterId) => void;
	}

	let {
		analysis,
		travellers,
		travellerLimits,
		characters,
		selected,
		query = $bindable(''),
		tools,
		item,
		groupAside,
		types,
		keepTypes,
		closedTypes,
		collapsibleKey,
		surface,
		onSelect
	}: Props = $props();

	/** The band's height, so each type's heading pins just beneath it. */
	let bandHeight = $state(0);
	const top = $derived(surface === 'page' ? 'var(--app-top)' : '0rem');
</script>

<div
	class="band"
	data-surface={surface}
	data-testid="selection-band"
	style:--band-top={top}
	bind:offsetHeight={bandHeight}
>
	<CountsBar {analysis} {travellers} {travellerLimits} />
	<div class="find">
		<CharacterSearchBox bind:query shortcut={surface === 'page'} />
		<div class="tools">{@render tools()}</div>
	</div>
</div>
<CharacterPicker
	{characters}
	mode="multi"
	{selected}
	bind:query
	showSearch={false}
	{collapsibleKey}
	{surface}
	contained={false}
	{types}
	pinTop="calc({top} + {Math.max(0, bandHeight - 1)}px)"
	{keepTypes}
	{closedTypes}
	{onSelect}
	{item}
	{groupAside}
/>

<style>
	/* Only the chosen counts stay in view while scrolling; the setup table scrolls away. */
	.band {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		position: sticky;
		top: var(--band-top);
		z-index: var(--z-raised);
		padding-block: var(--space-2);
		box-shadow: 0 1px 0 var(--border);
	}
	.band[data-surface='page'] {
		/* Edge to edge, so nothing shows beside it. */
		margin-inline: calc(-1 * var(--page-gutter));
		padding-inline: var(--page-gutter);
		/* The page's own background, pinned to the window as the body's is, so it lines up. */
		background: var(--page-background, var(--surface));
		background-attachment: fixed;
	}
	.band[data-surface='sheet'] {
		background: var(--dialog-background);
	}
	/* Search, then the tools as icon buttons right beside it. */
	.find {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.tools {
		display: flex;
		gap: var(--space-1);
	}
	.tools :global(.icon-button) {
		background: var(--surface-raised);
		box-shadow: var(--button-ring);
	}
	@media (hover: hover) {
		.tools :global(.icon-button:hover:not(:disabled)) {
			background: var(--surface-selected);
		}
	}
	/* A computer window: the band spans the characters' column, not the window. */
	@media (min-width: 75rem) {
		.band[data-surface='page'] {
			margin-inline: 0;
			padding-inline: 0;
		}
	}
</style>
