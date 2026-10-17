<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	<label class="field">
		<span class="visually-hidden">{label}</span>
		<input
			type="text"
			autocomplete="off"
			enterkeyhint="done"
			maxlength={MAX_LABEL_NAME}
			placeholder={label}
			aria-invalid={taken}
			bind:value={name}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					add();
				}
			}}
		/>
	</label>
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
		grid-column: 1 / -1;
		margin: 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
	.visually-hidden {
		position: absolute;
		width: 1px; /* px-ok: visually hidden, still read aloud */
		height: 1px; /* px-ok: visually hidden, still read aloud */
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
