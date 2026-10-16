<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { buildInfo as info } from '#lib/build-info.ts';
	import { errorLog } from '#lib/features/errors/report.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { REPOSITORY_URL, shortCommit } from './report-issue.ts';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<!-- The one About view in the app, opened from the footer. -->
<Dialog bind:open title={t('shell.aboutTitle')}>
	<p>{t('shell.aboutIntro')}</p>
	<dl>
		<dt>{t('shell.aboutVersion')}</dt>
		<dd>{info.version}</dd>
		<dt>{t('shell.aboutCommit')}</dt>
		<dd>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
				>{shortCommit(info)}</a
			>
		</dd>
		<dt>{t('shell.aboutBranch')}</dt>
		<dd>{info.branch}</dd>
		<dt>{t('shell.aboutChannel')}</dt>
		<dd>{info.channel}</dd>
		<dt>{t('shell.aboutBuilt')}</dt>
		<dd>{new Date(info.builtAt).toLocaleString()}</dd>
		<dt>{t('shell.aboutProblems')}</dt>
		<dd>
			<!-- Reopens the device's error log after its corner card was dismissed. -->
			<button
				type="button"
				class="link"
				onclick={() => {
					open = false;
					errorLog.showDetails();
				}}>{t('shell.aboutProblemsButton', { count: errorLog.entries.length })}</button
			>
		</dd>
	</dl>
	<p class="small">
		{t('shell.aboutNotice')}
	</p>
</Dialog>

<style>
	p {
		margin: var(--space-3) 0;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: calc(0.25 * var(--u)) calc(1 * var(--u));
	}
	dt {
		opacity: 0.75;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
		min-height: auto;
	}
	.link {
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		text-decoration: underline;
	}
	.small {
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
