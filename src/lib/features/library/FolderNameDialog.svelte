<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { MAX_LABEL_NAME, nameFree, siblings } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/** Renames a folder; Enter saves. New folders are made at once, named "New folder". */
	interface Props {
		open?: boolean;
		/** The folder being renamed. */
		folder?: string;
	}

	let { open = $bindable(false), folder }: Props = $props();

	let name = $state('');
	const renaming = $derived(libraryLabels.state.folders.find((f) => f.id === folder));
	const ok = $derived(
		!!renaming &&
			nameFree(siblings(libraryLabels.state, 'folders', renaming.parent), name, renaming.id)
	);

	// Starts from the folder's own name each time it opens.
	$effect(() => {
		if (open) name = renaming?.name ?? '';
	});

	function save() {
		if (!ok || !renaming) return;
		libraryLabels.rename('folders', renaming.id, name);
		open = false;
	}
</script>

<Dialog bind:open title={t('library.renameTitle')}>
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
		color: var(--evil-text);
	}
</style>
