<script lang="ts">
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	let query = $state('');
</script>

<svelte:head>
	<title>Page layout preview · Grim-Games</title>
</svelte:head>

<!-- Every slot of the shared page layout, for the page-layout e2e tests. -->
<Page title="Page layout preview">
	{#snippet actions()}
		<IconButton icon="share" label="Share" />
		<Button>Action</Button>
	{/snippet}
	{#snippet subtitle()}Subtitle line{/snippet}
	{#snippet toolbar()}
		<ClearableField bind:value={query}>
			<input type="search" aria-label="Search" bind:value={query} />
		</ClearableField>
	{/snippet}
	{#snippet side()}
		<PageSection title="Side">
			<p>Side column</p>
		</PageSection>
	{/snippet}
	<PageSection title="First section">
		<p>None</p>
	</PageSection>
	<PageSection title="Second section" collapsible storageKey="spike-page-second">
		<p>Collapsible content</p>
	</PageSection>
</Page>
