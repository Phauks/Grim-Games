<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
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
	<label class="field">
		<span>{t('library.name')}</span>
		<ClearableField bind:value={name}>
			<input
				type="text"
				autocomplete="off"
				enterkeyhint="done"
				maxlength={MAX_LABEL_NAME}
				aria-invalid={name.trim() !== '' && !ok}
				bind:value={name}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						save();
					}
				}}
			/>
		</ClearableField>
	</label>
	<p class="error" role="status">{name.trim() !== '' && !ok ? t('library.nameTaken') : ''}</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (open = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" icon="check" disabled={!ok} onclick={save}>{t('library.save')}</Button>
	{/snippet}
</Dialog>

<style>
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
