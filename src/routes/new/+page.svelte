<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import NewGame from '#lib/features/grimoire/NewGame.svelte';
</script>

<svelte:head>
	<title>New game · Grim-Games</title>
</svelte:head>

<Page title="New game">
	<ErrorBoundary area="grimoire">
		<NewGame />
	</ErrorBoundary>
</Page>
