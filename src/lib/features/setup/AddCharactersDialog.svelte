<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * Every character of a type there is, beyond the script's own: Travellers for the bag,
	 * Fabled and Loric for the game (Trevor, 2026-10-18). Searchable by name or ability; a
	 * tap adds or removes one. The Character Lab's + uses it too, for every type (plan M47,
	 * Trevor 2026-11-04: "like adding a character mid-game, which already has search there").
	 */
	interface Props {
		open: boolean;
		title: string;
		/** The types listed, in this order. */
		types: readonly CharacterType[];
		/** Every character of those types, recommended ones first. */
		characters: readonly Character[];
		selected: readonly CharacterId[];
		/** Marks the ones not on the script. */
		marker?: (character: Character) => string | undefined;
		/** Which characters to list at all. */
		filter?: (character: Character) => boolean;
		/** Each row shows its jinx count. */
		jinxCounts?: boolean;
		onToggle: (id: CharacterId) => void;
		/** Controls above the list, such as filters. */
		children?: Snippet;
	}

	let {
		open = $bindable(),
		title,
		types,
		characters,
		selected,
		marker,
		filter,
		jinxCounts = false,
		onToggle,
		children
	}: Props = $props();
	let query = $state('');
</script>

<Dialog bind:open {title} size="full">
	<div class="list" data-testid="add-characters">
		{@render children?.()}
		<SharedPicker
			{characters}
			mode="multi"
			{selected}
			bind:query
			{types}
			collapsibleKey="add-{types.join('-')}"
			{marker}
			{filter}
			{jinxCounts}
			onSelect={onToggle}
		/>
	</div>
</Dialog>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
		min-height: 0;
	}
</style>
