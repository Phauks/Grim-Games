<script lang="ts">
	import { page } from '$app/state';
	import { buildInfo as info } from '#lib/build-info.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { buildSwitch } from './build-switch.ts';
	import { describeBuild, REPOSITORY_URL, shortCommit } from './report-issue.ts';

	const other = $derived(buildSwitch(info, page.url));
</script>

<!-- The version, its commit and the switch to the other build, one small line at the bottom of
     the menu above the CCC logo (2026-10-23: the footer's place). Fixed size: more build detail
     is on the About page, never inline. -->
<p class="build" title={describeBuild(info)} data-testid="build-info">
	<span>v{info.version}</span>
	<span aria-hidden="true">·</span>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
		>{shortCommit(info)}</a
	>
	{#if other}
		<!-- Each build is its own origin, so its device data is separate (2026-10-19). An absolute
		     link to the other build's host, so there is no app path to resolve. -->
		<span aria-hidden="true">·</span>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={other.href} title={t('shell.switchBuildTitle')} data-testid="switch-build"
			>{other.to === 'beta' ? t('shell.switchToBeta') : t('shell.switchToProduction')}</a
		>
	{/if}
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
