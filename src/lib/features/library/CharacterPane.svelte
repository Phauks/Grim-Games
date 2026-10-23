<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { fieldsFromEntry, previewCharacter } from '#lib/core/rules/index.ts';
	import CharacterBuilderDialog from '#lib/features/character-builder/CharacterBuilderDialog.svelte';
	import type { SavedCharacter } from '#lib/features/character-builder/saved-characters.ts';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { GameData } from '#lib/core/data/index.ts';
	import ChangeKind from './ChangeKind.svelte';
	import ItemPane from './ItemPane.svelte';
	import LabelRows from './LabelRows.svelte';
	import { characterKey } from './library-items.ts';

	/** A character made in the Character builder, in the Library's pane. */
	interface Props {
		open?: boolean;
		saved: SavedCharacter;
		data: GameData | undefined;
		inline: boolean;
		/** The item it became, after Change kind. */
		onchanged?: (key: string) => void;
	}

	let { open = $bindable(false), saved, data, inline, onchanged }: Props = $props();
	let changingKind = $state(false);

	const fields = $derived(fieldsFromEntry(saved.entry));
	const character = $derived(previewCharacter(fields));
	let deleting = $state(false);
	// The Character builder opens over the Library, so editing never leaves it (Trevor, 2026-10-18).
	let editing = $state(false);

	function remove() {
		// Deleted before closing: closing unmounts this pane.
		savedCharacters.remove(saved.savedId);
		open = false;
	}
</script>

<ItemPane bind:open title={fields.name || t('common.none')} {inline}>
	{#snippet heading()}
		<CharacterBadge characterId={character.id} {character} interactive={false} />
	{/snippet}
	{#snippet headActions()}
		<IconButton icon="edit" label={t('library.editCharacter')} onclick={() => (editing = true)} />
		<IconButton
			icon="changeKind"
			label={t('library.changeKind')}
			onclick={() => (changingKind = true)}
		/>
		<DeleteButton label={t('library.deleteCharacter')} onclick={() => (deleting = true)} />
	{/snippet}
	<div class="character" data-testid="library-character">
		<CharacterSummary {character} />
		<dl>
			<LabelRows itemKey={characterKey(saved.savedId)} />
		</dl>
	</div>
</ItemPane>

<ChangeKind bind:open={changingKind} item={{ kind: 'character', saved }} {data} {onchanged} />
<CharacterBuilderDialog bind:open={editing} savedId={saved.savedId} />

<ConfirmDialog
	bind:open={deleting}
	title={t('library.deleteCharacterConfirm')}
	danger
	onConfirm={remove}
>
	<p><CharacterBadge characterId={character.id} {character} interactive={false} /></p>
	<p>{t('library.deleteCharacterBody')}</p>
</ConfirmDialog>

<style>
	.character {
		display: grid;
		gap: var(--space-4);
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
</style>
