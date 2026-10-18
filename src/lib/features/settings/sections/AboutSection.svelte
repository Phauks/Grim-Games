<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { REPOSITORY_URL, shortCommit } from '#lib/features/about/report-issue.ts';
	import { updateCheck } from '#lib/features/about/update-check.svelte.ts';
	import DiagnosticsPanel from '#lib/features/errors/DiagnosticsPanel.svelte';
	import RefreshDiagnostics from '#lib/features/errors/RefreshDiagnostics.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { ADVANCED_KEY } from './about-advanced.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	const RESULT = {
		idle: '',
		checking: 'shell.updateChecking',
		current: 'shell.updateCurrent',
		ready: 'shell.updateFound',
		failed: 'shell.updateCheckFailed',
		unsupported: 'shell.updateUnsupported'
	} as const;
	const result = $derived(RESULT[updateCheck.result]);

	// "Checked 18:58" today, with the date on other days.
	function checkedText(at: number): string {
		const today = new Date().toDateString() === new Date(at).toDateString();
		const time = intl.date(
			at,
			today ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }
		);
		return t('shell.updateCheckedAt', { time });
	}
	const status = $derived(
		updateCheck.result === 'checking'
			? t('shell.updateChecking')
			: [updateCheck.checkedAt ? checkedText(updateCheck.checkedAt) : '', result ? t(result) : '']
					.filter(Boolean)
					.join(' · ')
	);
</script>

<!-- The one About in the app (Trevor, 2026-10-16: About lives in Settings; the footer opens it). -->
<p>{t('shell.aboutIntro')}</p>
<dl>
	<dt>{t('shell.aboutVersion')}</dt>
	<!-- Check for updates sits small beside the version, with when it last checked and the
	     result on the same line, cut off rather than wrapped so nothing moves (Trevor, 2026-10-18). -->
	<dd class="version">
		<span>{info.version}</span>
		<IconButton
			icon="refresh"
			label={t('shell.checkUpdates')}
			disabled={updateCheck.result === 'checking'}
			onclick={() => void updateCheck.check()}
		/>
		<span class="result" role="status" data-testid="update-check-result">{status}</span>
	</dd>
	<dt>{t('shell.aboutCommit')}</dt>
	<dd>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
			>{shortCommit(info)}</a
		>
	</dd>
</dl>
<p class="small">{t('shell.aboutNotice')}</p>
<!-- Diagnostics, closed beneath About (Trevor, 2026-10-18); the version and commit show once,
     above, though the copied diagnostics still carry them. /diagnostics opens it. -->
<PageSection
	title={t('shell.aboutAdvanced')}
	level={3}
	collapsible
	storageKey={ADVANCED_KEY}
	defaultOpen={false}
>
	{#snippet aside()}<RefreshDiagnostics />{/snippet}
	<DiagnosticsPanel hideRows={['errors.diag.version', 'errors.diag.commit']} />
</PageSection>

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
	dt:has(+ .version) {
		align-self: center;
	}
	.version {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.result {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.small {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
