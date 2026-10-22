<script lang="ts">
	// What a waiting build brings: in the update card and in About (Trevor, 2026-10-19). A
	// merged PR shows as its number and title and opens the PR (Trevor, 2026-10-20).
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { REPOSITORY_URL } from './report-issue.ts';
	import type { BuildCommit, Changes } from './update-notes.ts';

	let { changes }: { changes: Changes } = $props();

	const link = (commit: BuildCommit) =>
		commit.pr ? `${REPOSITORY_URL}/pull/${commit.pr}` : `${REPOSITORY_URL}/commit/${commit.sha}`;
</script>

<div class="list" data-testid="update-changes">
	{#if changes.commits.length > 0}
		<ul>
			{#each changes.commits as commit (commit.sha)}
				<li>
					<!-- External GitHub link, not an app route. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={link(commit)} target="_blank" rel="noopener">
						<span class="sha">{commit.pr ? `#${commit.pr}` : commit.sha.slice(0, 7)}</span>
						<span class="subject">{commit.subject}</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if !changes.complete}<p class="more">{t('shell.olderChanges')}</p>{/if}
	{:else}
		<p class="more">{t('common.none')}</p>
	{/if}
</div>

<style>
	ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The whole row is the link, so each commit is one comfortable tap. */
	a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		color: inherit;
		text-decoration: none;
	}
	.sha {
		text-decoration: underline;
		font-variant-numeric: tabular-nums;
	}
	/* A title with a long unbroken word (a commit hash) wraps instead of widening the page. */
	.subject {
		overflow-wrap: anywhere;
	}
	.more {
		margin: var(--space-1) 0 0;
		color: var(--on-surface-muted);
	}
</style>
