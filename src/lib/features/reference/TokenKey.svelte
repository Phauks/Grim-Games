<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
	import type { LeafMarks } from '#lib/ui/token/leaves.ts';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
	const none = { firstNight: false, otherNight: false, reminders: 0, setup: false };
	const KEY: { marks: LeafMarks; text: PlainMessageKey }[] = [
		{ marks: { ...none, firstNight: true }, text: 'reference.key.firstNight' },
		{ marks: { ...none, otherNight: true }, text: 'reference.key.otherNight' },
		{ marks: { ...none, reminders: 3 }, text: 'reference.key.reminders' },
		{ marks: { ...none, setup: true }, text: 'reference.key.setup' }
	];
</script>

<!-- What the marks on a character token mean. -->
<Dialog bind:open title={t('reference.tokenKey')}>
	<ul class="key">
		{#each KEY as item (item.text)}
			<li><TokenFace label="" leaves={item.marks} size={44} /><span>{t(item.text)}</span></li>
		{/each}
	</ul>
</Dialog>

<style>
	.key {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
