<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import NewLabel from './NewLabel.svelte';
	import {
		byName,
		labelUses,
		MAX_LABEL_NAME,
		nameFree,
		type Label,
		type LabelKind
	} from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * The user's tags in the Library's sidebar (Trevor, 2026-10-18: tags in "the left side bar
	 * of the file nav"): tap one to show what carries it; add, rename and delete them here.
	 */
	interface Props {
		/** The tags the list is filtered by: items carrying every one. */
		filter?: string[];
	}

	let { filter = $bindable([]) }: Props = $props();

	const kind: LabelKind = 'tags';

	function toggle(id: string) {
		filter = filter.includes(id) ? filter.filter((f) => f !== id) : [...filter, id];
	}

	let renaming = $state<{ kind: LabelKind; label: Label }>();
	let renameOpen = $state(false);
	let renameText = $state('');
	const renameOk = $derived(
		!!renaming && nameFree(libraryLabels.state[renaming.kind], renameText, renaming.label.id)
	);

	let deleting = $state<{ kind: LabelKind; label: Label }>();
	let deleteOpen = $state(false);

	function startRename(kind: LabelKind, label: Label) {
		renaming = { kind, label };
		renameText = label.name;
		renameOpen = true;
	}

	function rename() {
		if (!renaming || !renameOk) return;
		libraryLabels.rename(renaming.kind, renaming.label.id, renameText);
		renameOpen = false;
	}
</script>

<ul class="tags" aria-label={t('library.tags')}>
	{#each byName(libraryLabels.state.tags) as label (label.id)}
		<li>
			<button
				type="button"
				class="tag"
				aria-pressed={filter.includes(label.id)}
				onclick={() => toggle(label.id)}>{label.name}</button
			>
			<IconButton
				icon="rename"
				label={t('library.renameNamed', { name: label.name })}
				onclick={() => startRename(kind, label)}
			/>
			<DeleteButton
				label={t('library.deleteNamed', { name: label.name })}
				onclick={() => {
					deleting = { kind, label };
					deleteOpen = true;
				}}
			/>
		</li>
	{:else}
		<li class="none">{t('common.none')}</li>
	{/each}
</ul>
<NewLabel {kind} label={t('library.newTag')} />

<Dialog bind:open={renameOpen} title={t('library.renameTitle')}>
	<TextField
		label={t('library.name')}
		bind:value={renameText}
		maxlength={MAX_LABEL_NAME}
		oncommit={() => {
			rename();
			return false;
		}}
	/>
	<p class="error" role="status">
		{renameText.trim() !== '' && !renameOk ? t('library.nameTaken') : ''}
	</p>
	{#snippet actions()}
		<ModalActions onCancel={() => (renameOpen = false)} onConfirm={rename} disabled={!renameOk} />
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={deleteOpen}
	title={deleting?.kind === 'folders'
		? t('library.deleteFolderConfirm')
		: t('library.deleteTagConfirm')}
	danger
	onConfirm={() => deleting && libraryLabels.delete(deleting.kind, deleting.label.id)}
>
	{#if deleting}
		<p>
			{t('library.deleteLabelBody', {
				name: deleting.label.name,
				count: labelUses(libraryLabels.state, deleting.kind, deleting.label.id)
			})}
		</p>
	{/if}
</ConfirmDialog>

<style>
	ul {
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-1);
		padding-block: var(--space-1);
	}
	/* The tag's own look, in the font its name was typed in (Trevor, 2026-10-18). */
	.tag {
		justify-self: start;
		max-width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
		font: inherit;
		font-family: var(--font-control);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.tag[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.none {
		display: block;
		padding-block: var(--space-2);
		color: var(--on-surface-muted);
	}
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
