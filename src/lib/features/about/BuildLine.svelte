<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { describeBuild, REPOSITORY_URL, shortCommit } from './report-issue.ts';
</script>

<!-- The version and its commit, one small line at the bottom of
     the menu above the CCC logo (2026-10-23: the footer's place). Fixed size: more build detail
     is on the About page, never inline; the switch to the other build is a menu row in App
     (Trevor, 2026-10-29). -->
<p class="build" title={describeBuild(info)} data-testid="build-info">
	<span>v{info.version}</span>
	<span aria-hidden="true">·</span>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
		>{shortCommit(info)}</a
	>
</p>

<style>
	.build {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: var(--space-1);
		margin: 0;
		padding: 0 var(--space-3);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		color: inherit;
		text-decoration: underline;
	}
</style>
