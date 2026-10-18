<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { cleanName, MAX_LABEL_NAME } from './library-labels.ts';

	/** Names something new, or renames it; Enter saves. */
	interface Props {
		open?: boolean;
		title: string;
		/** The name it starts from each time it opens. */
		initial?: string;
		onsave: (name: string) => void;
	}

	let { open = $bindable(false), title, initial = '', onsave }: Props = $props();

	let name = $state('');
	const ok = $derived(cleanName(name) !== '');

	$effect(() => {
		if (open) name = initial;
	});

	function save() {
		if (!ok) return;
		onsave(cleanName(name));
		open = false;
	}
</script>

<Dialog bind:open {title}>
	<TextField
		label={t('library.name')}
		bind:value={name}
		maxlength={MAX_LABEL_NAME}
		oncommit={() => {
			save();
			return false;
		}}
	/>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={save} disabled={!ok} />
	{/snippet}
</Dialog>
