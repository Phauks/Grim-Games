<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import UpdateChanges from '#lib/features/about/UpdateChanges.svelte';
	import { changeHistory, changelogReleases } from '#lib/features/about/changelog.ts';

	const releases = changelogReleases(changeHistory);
	/** A YYYY-MM-DD day in the reader's language; the day is UTC's, as the history records it. */
	const day = (date: string) =>
		intl.date(Date.parse(`${date}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head>
	<title>{t('shell.changelogTitle')}</title>
</svelte:head>

<Page title={t('shell.changelog')}>
	{#each releases as release (release.version)}
		<PageSection title={release.version ? `v${release.version}` : t('shell.unreleased')}>
			{#snippet aside()}<CountBadge count={release.count} />{/snippet}
			<!-- Only the newest day starts open: the whole history runs to hundreds of lines. -->
			<SectionStack edge>
				{#each release.days as { date, changes }, i (date)}
					<Collapsible
						title={day(date)}
						level={3}
						count={changes.commits.length}
						defaultOpen={i === 0 && release === releases[0]}
					>
						<UpdateChanges {changes} />
					</Collapsible>
				{/each}
			</SectionStack>
		</PageSection>
	{:else}
		<PageSection title={t('shell.unreleased')}>
			<UpdateChanges changes={{ commits: [], complete: changeHistory.complete }} />
		</PageSection>
	{/each}
</Page>
