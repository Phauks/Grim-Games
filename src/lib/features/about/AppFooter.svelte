<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { buildInfo as info } from '#lib/build-info.ts';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import { page } from '$app/state';
	import { describeBuild, REPOSITORY_URL, shortCommit } from './report-issue.ts';
	import { buildSwitch } from './build-switch.ts';

	const other = $derived(buildSwitch(info, page.url));
</script>

<footer>
	<!-- Every text link on the right (the CCC logo is at the bottom of the menu, Trevor 2026-10-17). Fixed-size line: more build detail lives in Settings > About and Diagnostics, never inline (no reflow). About is reached from Settings only (Trevor, 2026-10-18). -->
	<p class="build" title={describeBuild(info)} data-testid="build-info">
		<span class="nowrap"
			>v{info.version} ·
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
				>{shortCommit(info)}</a
			></span
		>
		<!-- Separators are hidden on narrow screens, where the links wrap and a dot would start a line. -->
		{#if other}
			<!-- Beside the build it switches from (Trevor, 2026-10-19). Each build is its own origin, so its device data is separate. -->
			<span class="sep" aria-hidden="true">·</span>
			<!-- An absolute link to the other build's host, so there is no app path to resolve. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="page"
				href={other.href}
				title={t('shell.switchBuildTitle')}
				data-testid="switch-build"
				>{other.to === 'beta' ? t('shell.switchToBeta') : t('shell.switchToProduction')}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		<span class="sep" aria-hidden="true">·</span>
		<a class="page" href={resolve('/changelog')}>{t('shell.changelog')}</a>
		<span class="sep" aria-hidden="true">·</span>
		<a class="page" href={resolve('/privacy')}>{t('shell.privacy')}</a>
		<span class="sep" aria-hidden="true">·</span>
		<button type="button" class="text-button" onclick={() => reportDialog.show()}
			>{t('shell.reportIssue')}</button
		>
	</p>
</footer>

<style>
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: calc(0.5 * var(--u)) calc(1 * var(--u));
		padding: calc(0.5 * var(--u)) max(calc(1 * var(--u)), env(safe-area-inset-right))
			calc(0.5 * var(--u) + env(safe-area-inset-bottom, 0px))
			max(calc(1 * var(--u)), env(safe-area-inset-left));
		font-size: 0.8rem;
		/* Meets the sidebar's dividing line (Trevor, 2026-10-16). */
		border-top: 1px solid var(--border);
	}
	footer > * {
		opacity: 0.8;
	}
	a {
		color: inherit;
		display: inline-flex;
		align-items: center;
	}
	.build {
		margin: 0;
		display: flex;
		/* Large text sizes wrap the links instead of widening the page past the screen. */
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: calc(0.4 * var(--u));
		margin-inline-start: auto;
	}
	.build a {
		text-decoration: underline;
	}
	.nowrap {
		white-space: nowrap;
	}
	@media (max-width: 47.99rem) {
		.build {
			column-gap: calc(0.75 * var(--u));
		}
		.sep {
			display: none;
		}
	}
	.page {
		min-height: var(--tap-target);
		padding: 0 calc(0.25 * var(--u));
	}
	.text-button {
		min-height: var(--tap-target);
		padding: 0 calc(0.25 * var(--u));
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
