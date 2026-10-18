<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	/**
	 * Save and Save as new on a builder page. Both are always there, so nothing moves; Save
	 * says Saved once nothing has changed, and only a changed saved one can be copied.
	 */
	interface Props {
		/** Something to save exists. */
		ready: boolean;
		/** What's on the builder is what is saved. */
		saved: boolean;
		/** It edits something already saved, so it can be saved as a new one. */
		editing: boolean;
		busy?: boolean;
		onSave: () => void;
		onSaveNew: () => void;
	}

	let { ready, saved, editing, busy = false, onSave, onSaveNew }: Props = $props();
</script>

<div class="save">
	<Button variant="accent" disabled={!ready || saved || busy} onclick={onSave}
		>{saved ? t('common.saved') : t('common.save')}</Button
	>
	<Button disabled={!ready || !editing || saved || busy} onclick={onSaveNew}
		>{t('common.saveNew')}</Button
	>
</div>

<style>
	.save {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
	}
</style>
