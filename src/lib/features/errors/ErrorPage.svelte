<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Character } from '#lib/core/data/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { errorLog } from './report.svelte.ts';

	const notFound = $derived(page.status === 404);
	// Page not found is a joke about the Fool (Trevor, 2026-10-18): the first time you die, you don't.
	let fool = $state.raw<Character>();
	let canGoBack = $state(false);

	onMount(() => {
		canGoBack = history.length > 1;
		if (notFound) {
			loadOfficialData()
				.then((data) => (fool = data.byId.get('fool')))
				.catch(() => {});
		}
	});
</script>

{#if notFound}
	<!-- Compact (Trevor, 2026-10-19): the Fool and the joke on the left, a thin line, the ways out
	     stacked on the right. Back is always there (disabled with nowhere to go back to), so nothing moves. -->
	<Page title={t('errors.pageNotFound')} width="text">
		<div class="not-found" data-testid="not-found">
			<figure class="fool">
				<!-- The icon's box is reserved while the character data loads. -->
				<div class="icon">
					{#if fool}
						<img src={iconUrl(fool)} alt={fool.name} />
					{/if}
				</div>
				<figcaption>{t('errors.notFoundJoke')}</figcaption>
			</figure>
			<div class="divider" aria-hidden="true"></div>
			<nav class="ways-out" aria-label={t('errors.pageNotFound')}>
				<Button variant="quiet" icon="back" disabled={!canGoBack} onclick={() => history.back()}
					>{t('errors.back')}</Button
				>
				<Button variant="quiet" icon="library" href={resolve('/library')}
					>{t('shell.navLibrary')}</Button
				>
				<Button
					variant="quiet"
					icon="report"
					onclick={() => reportDialog.show({ kind: 'bug', title: t('errors.pageNotFound') })}
					>{t('errors.diag.report')}</Button
				>
				<Button icon="home" href={resolve('/')}>{t('errors.home')}</Button>
			</nav>
		</div>
	</Page>
{:else}
	<!-- Details is always in the title row, so nothing moves. -->
	<Page title={t('errors.somethingWentWrong')} width="text">
		{#snippet actions()}
			<Button variant="quiet" onclick={() => errorLog.showDetails()}>{t('errors.details')}</Button>
			<Button href={resolve('/')}>{t('errors.home')}</Button>
		{/snippet}
		<p>{t('errors.pageFailedDetail')}</p>
	</Page>
{/if}

<style>
	.not-found {
		display: grid;
		/* The ways out keep their labels on one line; the Fool and the joke take what is left. */
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		align-content: start;
		gap: calc(var(--u) * 2);
		margin: calc(var(--u) * 3) 0;
	}

	.fool {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 2);
		margin: 0;
		text-align: center;
	}

	.icon {
		width: min(calc(var(--u) * 20), 30vw);
		aspect-ratio: 1;
	}

	.icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	figcaption {
		font-style: italic;
	}

	.divider {
		align-self: stretch;
		border-left: 1px solid var(--border);
	}

	.ways-out {
		display: flex;
		flex-direction: column;
		gap: calc(var(--u) * 2);
		white-space: nowrap;
	}
</style>
