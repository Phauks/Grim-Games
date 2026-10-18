<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';

	let list = $state<SavedGamesList>();
	let count = $state(0);
	let clearOpen = $state(false);
</script>

<svelte:head>
	<title>Resume game · {APP_NAME}</title>
</svelte:head>

<Page title="Resume game">
	{#snippet actions()}
		<DeleteButton
			label="Delete all saved games"
			disabled={count === 0}
			onclick={() => (clearOpen = true)}
		/>
	{/snippet}
	<ErrorBoundary area="grimoire">
		<SavedGamesList bind:this={list} onCount={(n) => (count = n)} />
	</ErrorBoundary>
</Page>

<!-- Finished games stay in History; this clears only the games still being played. -->
<ConfirmDialog
	bind:open={clearOpen}
	title={count === 1 ? 'Delete 1 saved game?' : `Delete all ${count} saved games?`}
	danger
	onConfirm={() => void list?.clearAll()}
>
	<p>
		They are removed from this device and cannot be brought back. Finished games stay in History.
	</p>
</ConfirmDialog>
