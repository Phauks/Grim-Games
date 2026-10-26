<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
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

<Page title="Resume game" iconActions>
	{#snippet actions()}
		<!-- New game left the sidebar for here and the board's ⋯ menu (Trevor, 2026-10-26). -->
		<IconButton
			icon="add"
			label={t('setup.newGame')}
			data-testid="games-new-game"
			onclick={() => void goto(resolve('/new'))}
		/>
		<DeleteButton
			label="Delete all saved games"
			disabled={count === 0}
			onclick={() => (clearOpen = true)}
		/>
	{/snippet}
	<ErrorBoundary area="grimoire">
		<SavedGamesList bind:this={list} onCount={(n) => (count = n)} />
	</ErrorBoundary>
	<!-- Games joined as a player are listed on Join game, once (Trevor, 2026-10-23); no link
	     to it here (Trevor, 2026-10-24), as the sidebar has one. -->
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
