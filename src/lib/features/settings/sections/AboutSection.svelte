<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { REPOSITORY_URL, shortCommit } from '#lib/features/about/report-issue.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { settingsDialog } from '../settings-dialog.svelte.ts';
</script>

<!-- The one About in the app (Trevor, 2026-10-16: About lives in Settings; the footer opens it). -->
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
</dl>
<!-- Build details and the problem log are in the Diagnostics section. -->
<button type="button" class="diagnostics" onclick={() => settingsDialog.show('diagnostics')}>
	<Icon name="diagnostics" />
	<span>{t('shell.navDiagnostics')}</span>
</button>
<p class="small">{t('shell.aboutNotice')}</p>

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
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
	}
	.diagnostics {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin-top: var(--space-2);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.small {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
