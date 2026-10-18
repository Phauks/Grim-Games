<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { REPOSITORY_URL, shortCommit } from '#lib/features/about/report-issue.ts';
	import { updateCheck } from '#lib/features/about/update-check.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	const RESULT = {
		idle: '',
		checking: 'shell.updateChecking',
		current: 'shell.updateCurrent',
		ready: 'shell.updateFound',
		failed: 'shell.updateCheckFailed',
		unsupported: 'shell.updateUnsupported'
	} as const;
	const result = $derived(RESULT[updateCheck.result]);
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
	<dt>{t('shell.aboutUpdates')}</dt>
	<dd class="updates">
		<Button
			icon="refresh"
			disabled={updateCheck.result === 'checking'}
			onclick={() => void updateCheck.check()}>{t('shell.checkUpdates')}</Button
		>
		<!-- Always there, so the result appears in place without moving anything (no reflow). -->
		<span class="result" role="status" data-testid="update-check-result"
			>{result ? t(result) : ''}</span
		>
	</dd>
</dl>
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
	dt:has(+ .updates) {
		align-self: center;
	}
	.updates {
		display: grid;
		justify-items: start;
		gap: var(--space-1);
	}
	.result {
		min-height: 1.3em;
		line-height: 1.3;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.small {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
