<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SavedGamesList from './SavedGamesList.svelte';

	/**
	 * The games this device is storytelling, on Join game's page under the rooms it joined as a
	 * player (Trevor, 2026-10-28: one page for joining and resuming, games played above games
	 * hosted). Delete all clears only these; finished games stay in History.
	 */
	let list = $state<SavedGamesList>();
	let count = $state(0);
	let clearOpen = $state(false);
</script>

<!-- Opens and closes from its heading (Trevor, 2026-10-28). -->
<PageSection
	title={t('room.asStoryteller')}
	collapsible
	storageKey="continue.as-storyteller"
	{count}
>
	{#snippet aside()}
		<DeleteButton
			label="Delete all saved games"
			disabled={count === 0}
			onclick={() => (clearOpen = true)}
		/>
	{/snippet}
	<ErrorBoundary area="grimoire">
		<SavedGamesList bind:this={list} onCount={(n) => (count = n)} />
	</ErrorBoundary>
</PageSection>

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
