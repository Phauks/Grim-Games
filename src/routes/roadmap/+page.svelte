<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { REPOSITORY_URL } from '#lib/features/about/report-issue.ts';
	import { changeHistory } from '#lib/features/about/changelog.ts';
	import { ROADMAP, roadmapStatus } from '#lib/features/about/roadmap.ts';
	import type { BuildCommit } from '#lib/features/about/update-notes.ts';

	const areas = roadmapStatus(ROADMAP, changeHistory.changes);
	const link = (commit: BuildCommit) =>
		commit.pr ? `${REPOSITORY_URL}/pull/${commit.pr}` : `${REPOSITORY_URL}/commit/${commit.sha}`;
</script>

<svelte:head>
	<title>{t('shell.roadmapTitle')}</title>
</svelte:head>

<Page title={t('shell.roadmap')}>
	{#each areas as area (area.title)}
		<PageSection title={area.title}>
			{#snippet aside()}<span class="progress"
					>{t('shell.roadmapProgress', {
						done: area.items.filter((item) => item.doneBy).length,
						total: area.items.length
					})}</span
				>{/snippet}
			<ul>
				{#each area.items as item (item.id)}
					<li data-testid="roadmap-item" data-done={item.doneBy ? '' : undefined}>
						{#if item.doneBy}
							<!-- External GitHub link, not an app route: the change that finished it. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={link(item.doneBy)} target="_blank" rel="noopener">
								<span class="mark"><Icon name="check" label={t('shell.roadmapDone')} /></span>
								<span class="id">{item.id}</span>
								<span>{item.title}</span>
							</a>
						{:else}
							<div class="row">
								<!-- The tick's place is kept, so finished items don't shift the text. -->
								<span class="mark" role="img" aria-label={t('shell.roadmapPlanned')}></span>
								<span class="id">{item.id}</span>
								<span>{item.title}</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</PageSection>
	{/each}
</Page>

<style>
	ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a,
	.row {
		display: grid;
		grid-template-columns: 1.25em 3em 1fr;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		color: inherit;
		text-decoration: none;
	}
	a .id {
		text-decoration: underline;
	}
	.mark {
		display: inline-grid;
		place-items: center;
	}
	.id {
		font-variant-numeric: tabular-nums;
		color: var(--on-surface-muted);
	}
	.progress {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
