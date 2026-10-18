<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId, GameData } from '#lib/core/data/index.ts';
	import { fieldsFromEntry, previewCharacter } from '#lib/core/rules/index.ts';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { timestampName } from '#lib/core/timestamp-name.ts';
	import ChangeKind from './ChangeKind.svelte';
	import ItemPane from './ItemPane.svelte';
	import LabelRows from './LabelRows.svelte';
	import NameDialog from './NameDialog.svelte';
	import { savedIdOf, savedRef, type CharacterCollection } from './library-collections.ts';
	import { characterCollections } from './library-collections.svelte.ts';
	import { collectionKey } from './library-items.ts';

	/** A character collection in the Library's pane: its characters, chosen from every one. */
	interface Props {
		open?: boolean;
		collection: CharacterCollection;
		data: GameData | undefined;
		inline: boolean;
		/** The item it became, after Change kind. */
		onchanged?: (key: string) => void;
	}

	let { open = $bindable(false), collection, data, inline, onchanged }: Props = $props();
	let changingKind = $state(false);

	/** Every character a collection can hold: TPI's, then the Character builder's. */
	const choices = $derived.by(() => {
		const official = (data?.characters ?? []).map((c) => [c.id as string, c] as const);
		const ids = new Set(official.map(([id]) => id));
		const saved = savedCharacters.list.flatMap((s) => {
			const character = previewCharacter(fieldsFromEntry(s.entry));
			// A homebrew character with an official id would be listed twice.
			return ids.has(character.id) ? [] : [[savedRef(s.savedId), character] as const];
		});
		return new Map<string, Character>([...official, ...saved]);
	});
	const refOf = $derived(new Map([...choices].map(([ref, c]) => [c.id as string, ref])));
	const members = $derived(
		collection.characters.flatMap((ref) => {
			const character = choices.get(ref);
			return character ? [{ ref, character }] : [];
		})
	);
	const selected = $derived(members.map((m) => m.character.id));
	/** Character builder characters deleted since: still counted, so nothing vanishes silently. */
	const missing = $derived(collection.characters.length - members.length);

	let choosing = $state(false);
	let renaming = $state(false);
	let deleting = $state(false);

	function toggle(id: CharacterId) {
		const ref = refOf.get(id);
		if (ref) characterCollections.toggle(collection.id, ref);
	}
</script>

<ItemPane bind:open title={collection.name} {inline}>
	{#snippet headActions()}
		<IconButton
			icon="add"
			label={t('library.chooseCharacters')}
			onclick={() => (choosing = true)}
		/>
		<IconButton
			icon="rename"
			label={t('library.renameNamed', { name: collection.name })}
			onclick={() => (renaming = true)}
		/>
		<IconButton
			icon="changeKind"
			label={t('library.changeKind')}
			onclick={() => (changingKind = true)}
		/>
		<DeleteButton label={t('library.deleteCollection')} onclick={() => (deleting = true)} />
	{/snippet}
	<div class="collection" data-testid="library-collection">
		<ul class="members" aria-label={t('library.characters')}>
			{#each members as m (m.ref)}
				<li>
					<CharacterBadge
						characterId={m.character.id}
						character={savedIdOf(m.ref) ? m.character : undefined}
					/>
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
		{#if missing > 0}
			<p class="none">{t('library.missingCharacters', { count: missing })}</p>
		{/if}
		<dl>
			<LabelRows itemKey={collectionKey(collection.id)} />
		</dl>
	</div>
</ItemPane>

<Dialog bind:open={choosing} title={t('library.chooseCharacters')} size="full">
	<CharacterPicker characters={[...choices.values()]} mode="multi" {selected} onSelect={toggle} />
</Dialog>

<ChangeKind bind:open={changingKind} item={{ kind: 'collection', collection }} {data} {onchanged} />

<NameDialog
	bind:open={renaming}
	title={t('library.renameTitle')}
	initial={collection.name}
	blankName={timestampName}
	onsave={(name) => characterCollections.rename(collection.id, name)}
/>

<ConfirmDialog
	bind:open={deleting}
	title={t('library.deleteCollectionConfirm')}
	danger
	onConfirm={() => {
		// Deleted before closing: closing unmounts this pane.
		characterCollections.delete(collection.id);
		open = false;
	}}
>
	<p>{t('library.deleteCollectionBody', { name: collection.name })}</p>
</ConfirmDialog>

<style>
	.collection {
		display: grid;
		gap: var(--space-4);
	}
	.members {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
</style>
