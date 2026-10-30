<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { REPOSITORY_URL } from '#lib/features/about/report-issue.ts';
	import { changeHistory } from '#lib/features/about/changelog.ts';
	import {
		ROADMAP,
		roadmapByArea,
		roadmapStatus,
		type RoadmapArea
	} from '#lib/features/about/roadmap.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import type { BuildCommit } from '#lib/features/about/update-notes.ts';

	const AREA_TITLES = {
		storyteller: 'shell.roadmapAreaStoryteller',
		player: 'shell.roadmapAreaPlayer',
		search: 'shell.roadmapAreaSearch',
		library: 'shell.roadmapAreaLibrary',
		prepare: 'shell.roadmapAreaPrepare',
		friends: 'shell.roadmapAreaFriends',
		profile: 'shell.roadmapAreaProfile',
		history: 'shell.roadmapAreaHistory',
		app: 'shell.roadmapAreaApp'
	} as const satisfies Record<RoadmapArea, MessageKey>;
	const areas = roadmapByArea(roadmapStatus(ROADMAP, changeHistory.changes));
	const link = (commit: BuildCommit) =>
		commit.pr ? `${REPOSITORY_URL}/pull/${commit.pr}` : `${REPOSITORY_URL}/commit/${commit.sha}`;
</script>

<svelte:head>
	<title>{t('shell.roadmapTitle')}</title>
</svelte:head>

<Page title={t('shell.roadmap')}>
	<!-- One caret section per area of the app (Trevor, 2026-10-30), its done count beside it. -->
	<SectionStack edge>
		{#each areas as { area, items, done } (area)}
			<PageSection title={t(AREA_TITLES[area])} collapsible storageKey="roadmap-{area}">
				{#snippet aside()}<CountBadge count={done} total={items.length} />{/snippet}
				<ul data-testid="roadmap-{area}">
					{#each items as item (item.title)}
						<li
							data-testid="roadmap-item"
							data-done={item.doneBy ? '' : undefined}
							data-later={item.later && !item.doneBy ? '' : undefined}
						>
							{#if item.doneBy}
								<!-- External GitHub link, not an app route: the change that finished it. -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={link(item.doneBy)} target="_blank" rel="noopener">
									<span class="mark"><Icon name="check" label={t('shell.roadmapDone')} /></span>
									<span class="title">{item.title}</span>
								</a>
							{:else}
								<div class="row">
									<!-- The tick's place is kept, so finished items don't shift the text. -->
									<span class="mark" role="img" aria-label={t('shell.roadmapPlanned')}></span>
									<span class="title">{item.title}</span>
									{#if item.later}
										<span class="progress">{t('shell.roadmapLater')}</span>
									{:else if item.total > 1}
										<span class="progress"
											>{t('shell.roadmapProgress', {
												done: item.finished,
												total: item.total
											})}</span
										>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</PageSection>
		{/each}
	</SectionStack>
</Page>

<style>
	ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li + li {
		border-top: var(--card-border);
	}
	a,
	.row {
		display: grid;
		grid-template-columns: 1.25em minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding-block: var(--space-1);
		color: inherit;
		text-decoration: none;
	}
	a .title {
		text-decoration: underline;
	}
	.title {
		overflow-wrap: anywhere;
	}
	.mark {
		display: inline-grid;
		place-items: center;
	}
	.progress {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		color: var(--on-surface-muted);
	}
</style>
