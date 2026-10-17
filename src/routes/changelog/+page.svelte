<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { RELEASES, releaseSections, type ChangeCategory } from '#lib/features/about/changelog.ts';

	const CATEGORY_KEYS = {
		Added: 'shell.changeAdded',
		Changed: 'shell.changeChanged',
		Deprecated: 'shell.changeDeprecated',
		Removed: 'shell.changeRemoved',
		Fixed: 'shell.changeFixed',
		Security: 'shell.changeSecurity'
	} as const satisfies Record<ChangeCategory, MessageKey>;
</script>

<svelte:head>
	<title>{t('shell.changelogTitle')}</title>
</svelte:head>

<Page title={t('shell.changelog')}>
	{#each RELEASES as release (release.version)}
		<PageSection title={release.version ? `v${release.version}` : t('shell.unreleased')}>
			{#snippet aside()}{#if release.date}<span class="date">{release.date}</span>{/if}{/snippet}
			<div class="categories">
				{#each releaseSections(release) as { category, items } (category)}
					<div>
						<h3>{t(CATEGORY_KEYS[category])}</h3>
						{#if items.length}
							<ul>
								{#each items as item, i (i)}<li>{item}</li>{/each}
							</ul>
						{:else}
							<p class="none">{t('common.none')}</p>
						{/if}
					</div>
				{/each}
			</div>
		</PageSection>
	{/each}
</Page>

<style>
	/* The six categories sit side by side on wider screens, in rows that divide six evenly. */
	.categories {
		display: grid;
		gap: 0 var(--space-6);
	}
	@media (min-width: 40rem) {
		.categories {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.categories {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (min-width: 100rem) {
		.categories {
			grid-template-columns: repeat(6, 1fr);
		}
	}
	.date {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 1rem;
	}
	ul,
	p {
		margin: 0;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
