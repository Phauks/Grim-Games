<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { errorLog } from './report.svelte.ts';

	const notFound = $derived(page.status === 404);
</script>

<main data-testid="error-page">
	<h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
	<p>
		{notFound ? 'There is nothing at this address.' : 'This page could not open.'}
	</p>
	<div class="actions">
		<Button href={resolve('/')}>Home</Button>
		{#if !notFound}
			<Button variant="quiet" onclick={() => errorLog.showDetails()}>Details</Button>
		{/if}
	</div>
</main>

<style>
	main {
		padding: var(--space-4);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
