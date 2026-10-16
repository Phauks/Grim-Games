<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { errorLog } from './report.svelte.ts';

	const notFound = $derived(page.status === 404);
</script>

<main data-testid="error-page">
	<h1>{notFound ? t('errors.pageNotFound') : t('errors.somethingWentWrong')}</h1>
	<p>
		{notFound ? t('errors.pageNotFoundDetail') : t('errors.pageFailedDetail')}
	</p>
	<div class="actions">
		<Button href={resolve('/')}>{t('errors.home')}</Button>
		{#if !notFound}
			<Button variant="quiet" onclick={() => errorLog.showDetails()}>{t('errors.details')}</Button>
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
