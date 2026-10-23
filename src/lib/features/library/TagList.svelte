<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import GroupHead from './GroupHead.svelte';
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
	 * of the file nav"): tap one to show what carries it. Kept compact (Trevor, 2026-10-18: "it
	 * is so big"): New tag and Manage tags sit in the heading and open dialogs.
	 */
	interface Props {
		/** The tags the list is filtered by: items carrying every one. */
		filter?: string[];
		/** The id of the Tags heading, which names the sidebar's section. */
		headingId: string;
		/** Folded away from its heading. */
		open?: boolean;
	}

	let { filter = $bindable([]), headingId, open = $bindable(true) }: Props = $props();

	const kind: LabelKind = 'tags';
	const tags = $derived(byName(libraryLabels.state.tags));
	let adding = $state(false);
	let managing = $state(false);

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

<GroupHead id={headingId} title={t('library.tags')} bind:open>
	{#snippet actions()}
		<IconButton icon="add" label={t('library.newTag')} onclick={() => (adding = true)} />
		<IconButton icon="more" label={t('library.manageTags')} onclick={() => (managing = true)} />
	{/snippet}
</GroupHead>
<!-- Wrapped chips, one tap each to filter; renaming and deleting wait in Manage tags. -->
<ul class="tags" aria-label={t('library.tags')} hidden={!open}>
	{#each tags as label (label.id)}
		<li>
			<button
				type="button"
				class="tag"
				aria-pressed={filter.includes(label.id)}
				onclick={() => toggle(label.id)}>{label.name}</button
			>
		</li>
	{:else}
		<li class="none">{t('common.none')}</li>
	{/each}
</ul>

<Dialog bind:open={adding} title={t('library.newTag')}>
	<NewLabel {kind} label={t('library.newTag')} onadd={() => (adding = false)} />
</Dialog>

<Dialog bind:open={managing} title={t('library.manageTags')}>
	<ul class="manage" aria-label={t('library.tags')}>
		{#each tags as label (label.id)}
			<li>
				<span class="tag static">{label.name}</span>
				<IconButton
					icon="edit"
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
</Dialog>

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
	/* A folded group: its list keeps its place in the markup, out of view. */
	ul[hidden] {
		display: none;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.tags li {
		max-width: 100%;
	}
	.manage {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	.manage li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-1);
	}
	/* The tag's own look, in the font its name was typed in (Trevor, 2026-10-18). */
	.tag {
		display: inline-flex;
		align-items: center;
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
	.static {
		cursor: default;
	}
	.tag[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.none {
		color: var(--on-surface-muted);
	}
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
