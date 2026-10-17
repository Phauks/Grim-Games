<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
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

	/** The user's folders and tags: add, rename and delete them. */
	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const KINDS: readonly { kind: LabelKind; title: 'library.folders' | 'library.tags' }[] = [
		{ kind: 'folders', title: 'library.folders' },
		{ kind: 'tags', title: 'library.tags' }
	];

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

<Dialog bind:open title={t('library.manage')}>
	{#each KINDS as { kind, title } (kind)}
		<section aria-labelledby="manage-{kind}">
			<h2 id="manage-{kind}">{t(title)}</h2>
			<ul>
				{#each byName(libraryLabels.state[kind]) as label (label.id)}
					<li>
						<span class="name">{label.name}</span>
						<IconButton
							icon="rename"
							label={t('library.renameNamed', { name: label.name })}
							onclick={() => startRename(kind, label)}
						/>
						<span class="danger">
							<IconButton
								icon="remove"
								label={t('library.deleteNamed', { name: label.name })}
								onclick={() => {
									deleting = { kind, label };
									deleteOpen = true;
								}}
							/>
						</span>
					</li>
				{:else}
					<li class="none">{t('common.none')}</li>
				{/each}
			</ul>
			<NewLabel {kind} label={t(kind === 'folders' ? 'library.newFolder' : 'library.newTag')} />
		</section>
	{/each}
</Dialog>

<Dialog bind:open={renameOpen} title={t('library.renameTitle')}>
	<label class="field">
		<span>{t('library.name')}</span>
		<input
			type="text"
			autocomplete="off"
			enterkeyhint="done"
			maxlength={MAX_LABEL_NAME}
			bind:value={renameText}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					rename();
				}
			}}
		/>
	</label>
	<p class="error" role="status">
		{renameText.trim() !== '' && !renameOk ? t('library.nameTaken') : ''}
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (renameOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" icon="check" disabled={!renameOk} onclick={rename}
			>{t('library.save')}</Button
		>
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
	section {
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		border-bottom: var(--card-border);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.none {
		display: block;
		padding-block: var(--space-2);
		color: var(--on-surface-muted);
	}
	.danger :global(.icon-button:not(:disabled)) {
		color: var(--evil);
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: inherit;
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
