<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * Every Traveller there is, to put in the bag beside the recommended ones (Trevor,
	 * 2026-10-18). Searchable by name or ability; a tap adds or removes one.
	 */
	interface Props {
		open: boolean;
		/** Every Traveller, recommended ones first. */
		travellers: readonly Character[];
		selected: readonly CharacterId[];
		/** Marks the ones not on the script. */
		marker: (character: Character) => string | undefined;
		onToggle: (id: CharacterId) => void;
	}

	let { open = $bindable(), travellers, selected, marker, onToggle }: Props = $props();
	let query = $state('');
</script>

<Dialog bind:open title={t('setup.allTravellers')} size="full">
	<div class="list" data-testid="all-travellers">
		<SharedPicker
			characters={travellers}
			mode="multi"
			{selected}
			bind:query
			types={['traveller']}
			collapsibleKey="all-travellers"
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
