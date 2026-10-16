<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
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

<main>
	<h1>{t('shell.changelog')}</h1>
	{#each RELEASES as release (release.version)}
		<section aria-labelledby="release-{release.version ?? 'unreleased'}">
			<h2 id="release-{release.version ?? 'unreleased'}">
				{release.version ? `v${release.version}` : t('shell.unreleased')}
				{#if release.date}<span class="date">{release.date}</span>{/if}
			</h2>
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
		</section>
	{/each}
</main>

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter);
	}
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
	h1 {
		margin-top: 0;
		font-size: 1.6rem;
	}
	h2 {
		margin: var(--space-4) 0 var(--space-2);
		font-size: 1.2rem;
	}
	.date {
		margin-left: var(--space-2);
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
