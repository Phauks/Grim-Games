<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { MAX_LABEL_NAME, nameFree, type LabelKind } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/** A name field and Add for a new folder or tag; Enter adds too. */
	interface Props {
		kind: LabelKind;
		label: string;
		/** Called with the new label's id. */
		onadd?: (id: string) => void;
	}

	let { kind, label, onadd }: Props = $props();
	let name = $state('');
	const taken = $derived(name.trim() !== '' && !nameFree(libraryLabels.state[kind], name));

	function add() {
		const id = libraryLabels.add(kind, name);
		if (!id) return;
		name = '';
		onadd?.(id);
	}
</script>

<div class="new">
	<TextField
		{label}
		hideLabel
		placeholder={label}
		bind:value={name}
		maxlength={MAX_LABEL_NAME}
		invalid={taken}
		oncommit={() => {
			add();
			// Stays in the field, ready for the next name.
			return false;
		}}
	/>
	<Button icon="add" disabled={name.trim() === '' || taken} onclick={add}>{t('library.add')}</Button
	>
	<!-- Always there, so the message never moves what is below. -->
	<p class="error" role="status">{taken ? t('library.nameTaken') : ''}</p>
</div>

<style>
	.new {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-2);
		align-items: center;
	}
	.error {
		grid-column: 1 / -1;
		margin: 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
