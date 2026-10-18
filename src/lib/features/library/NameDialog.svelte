<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { MAX_LABEL_NAME } from './library-labels.ts';

	/** Names something new, or renames it; Enter saves. */
	interface Props {
		open?: boolean;
		title: string;
		/** The name it starts from each time it opens. */
		initial?: string;
		onsave: (name: string) => void;
		/** The longest name allowed; a folder's or tag's by default. */
		maxlength?: number;
	}

	let {
		open = $bindable(false),
		title,
		initial = '',
		onsave,
		maxlength = MAX_LABEL_NAME
	}: Props = $props();

	let name = $state('');
	const clean = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, maxlength);
	const ok = $derived(clean(name) !== '');

	$effect(() => {
		if (open) name = initial;
	});

	function save() {
		if (!ok) return;
		onsave(clean(name));
		open = false;
	}
</script>

<Dialog bind:open {title}>
	<TextField
		label={t('library.name')}
		bind:value={name}
		{maxlength}
		oncommit={() => {
			save();
			return false;
		}}
	/>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={save} disabled={!ok} />
	{/snippet}
</Dialog>
