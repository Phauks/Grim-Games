<script lang="ts">
	import type { Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * Every character of a type there is, beyond the script's own: Travellers for the bag,
	 * Fabled and Loric for the game (Trevor, 2026-10-18). Searchable by name or ability; a
	 * tap adds or removes one.
	 */
	interface Props {
		open: boolean;
		title: string;
		type: CharacterType;
		/** Every character of the type, recommended ones first. */
		characters: readonly Character[];
		selected: readonly CharacterId[];
		/** Marks the ones not on the script. */
		marker: (character: Character) => string | undefined;
		onToggle: (id: CharacterId) => void;
	}

	let { open = $bindable(), title, type, characters, selected, marker, onToggle }: Props = $props();
	let query = $state('');
</script>

<Dialog bind:open {title} size="full">
	<div class="list" data-testid="add-characters">
		<SharedPicker
			{characters}
			mode="multi"
			{selected}
			bind:query
			types={[type]}
			collapsibleKey="add-{type}"
			{marker}
			onSelect={onToggle}
		/>
	</div>
</Dialog>

<style>
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
