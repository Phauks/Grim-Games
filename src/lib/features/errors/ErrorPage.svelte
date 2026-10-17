<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { errorLog } from './report.svelte.ts';

	const notFound = $derived(page.status === 404);
</script>

<!-- Details is always in the title row (disabled for an unknown address), so nothing moves. -->
<Page title={notFound ? t('errors.pageNotFound') : t('errors.somethingWentWrong')} width="text">
	{#snippet actions()}
		<Button variant="quiet" disabled={notFound} onclick={() => errorLog.showDetails()}
			>{t('errors.details')}</Button
		>
		<Button href={resolve('/')}>{t('errors.home')}</Button>
	{/snippet}
	<p>{notFound ? t('errors.pageNotFoundDetail') : t('errors.pageFailedDetail')}</p>
</Page>
