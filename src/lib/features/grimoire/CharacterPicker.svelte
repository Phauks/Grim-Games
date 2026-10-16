<script lang="ts">
	import type { CharacterId, CharacterType, Script } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { pickerGroups } from './board.ts';

	/**
	 * The board's character choice in a dialog: the shared searchable picker (rows with
	 * token, name and ability), script characters first, and a switch to include characters
	 * not on the script.
	 */
	interface Props {
		open: boolean;
		title: string;
		characters: CharacterLookup;
		script: Script;
		types: readonly CharacterType[];
		/** Marked as the current choice. */
		current?: CharacterId;
		/** Hide the "not on the script" switch (Fabled and Loric are never on a script sheet). */
		alwaysAll?: boolean;
		onPick: (id: CharacterId) => void;
	}

	let {
		open = $bindable(),
		title,
		characters,
		script,
		types,
		current,
		alwaysAll = false,
		onPick
	}: Props = $props();

	let showAll = $state(false);
	let query = $state('');
	const list = $derived(
		pickerGroups(characters, script, types, alwaysAll || showAll).flatMap((g) => g.characters)
	);
	$effect(() => {
		if (!open) query = '';
	});
</script>

<Dialog bind:open {title} size="full">
	{#if !alwaysAll}
		<div class="switch">
			<Toggle
				label="Include characters not on the script"
				checked={showAll}
				onChange={(v) => (showAll = v)}
			/>
		</div>
	{/if}
	<div class="list">
		<SharedPicker
			characters={list}
			{types}
			selected={current ? [current] : []}
			bind:query
			onSelect={onPick}
		/>
	</div>
</Dialog>

<style>
	.switch {
		flex: none;
		padding-bottom: var(--space-2);
	}
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
