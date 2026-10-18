<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { MAX_LABEL_NAME, nameFree, siblings } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/** Names a new folder inside `parent`, or renames `folder`; Enter saves. */
	interface Props {
		open?: boolean;
		/** The folder being renamed; a new folder when none. */
		folder?: string;
		/** Where a new folder goes (the top level when none). */
		parent?: string;
		/** Called with the new folder's id. */
		oncreated?: (id: string) => void;
	}

	let { open = $bindable(false), folder, parent, oncreated }: Props = $props();

	let name = $state('');
	const renaming = $derived(libraryLabels.state.folders.find((f) => f.id === folder));
	const inside = $derived(renaming ? renaming.parent : parent);
	const ok = $derived(
		nameFree(siblings(libraryLabels.state, 'folders', inside), name, renaming?.id)
	);

	// Starts from the folder's own name each time it opens.
	$effect(() => {
		if (open) name = renaming?.name ?? '';
	});

	function save() {
		if (!ok) return;
		if (renaming) {
			libraryLabels.rename('folders', renaming.id, name);
		} else {
			const id = libraryLabels.add('folders', name, parent);
			if (id) oncreated?.(id);
		}
		open = false;
	}
</script>

<Dialog bind:open title={renaming ? t('library.renameTitle') : t('library.newFolder')}>
	<TextField
		label={t('library.name')}
		bind:value={name}
		maxlength={MAX_LABEL_NAME}
		invalid={name.trim() !== '' && !ok}
		oncommit={save}
	/>
	<p class="error" role="status">{name.trim() !== '' && !ok ? t('library.nameTaken') : ''}</p>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={save} disabled={!ok} />
	{/snippet}
</Dialog>

<style>
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
