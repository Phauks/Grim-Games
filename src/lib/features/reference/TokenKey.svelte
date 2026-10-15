<script lang="ts">
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
	const none = { firstNight: false, otherNight: false, reminders: 0, setup: false };
	const KEY = [
		{ marks: { ...none, firstNight: true }, text: 'Leaf on the left: wakes on the first night.' },
		{ marks: { ...none, otherNight: true }, text: 'Leaf on the right: wakes on other nights.' },
		{ marks: { ...none, reminders: 3 }, text: 'Leaves across the top: one per reminder token.' },
		{ marks: { ...none, setup: true }, text: 'Flower at the bottom right: changes setup.' }
	];
</script>

<!-- What the marks on a character token mean. -->
<Dialog bind:open title="Token key">
	<ul class="key">
		{#each KEY as item (item.text)}
			<li><TokenFace label="" leaves={item.marks} size={44} /><span>{item.text}</span></li>
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
