<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { buildInfo } from '#lib/build-info.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { collectDiagnostics } from './collect-diagnostics.svelte.ts';
	import {
		diagnosticsFileName,
		diagnosticsReportUrl,
		diagnosticsText,
		type Diagnostics
	} from './diagnostics.ts';
	import { errorLog } from './report.svelte.ts';

	// Gathered on this device when the page opens; nothing is sent unless the person taps Report.

	let diagnostics = $state<Diagnostics>();
	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);
	const text = $derived(diagnostics ? diagnosticsText(diagnostics, label) : '');
	const reportUrl = $derived(diagnosticsReportUrl(text, buildInfo, navigator.userAgent));

	async function gather() {
		diagnostics = await collectDiagnostics();
	}
	onMount(gather);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			toast(t('errors.copied'), t('errors.diag.copiedDetail'));
		} catch {
			toast(t('errors.copyFailed'), t('errors.copyFailedDetail'));
		}
	}

	function download() {
		if (!diagnostics) return;
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = diagnosticsFileName(diagnostics.gatheredAt);
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="panel" data-testid="diagnostics" aria-busy={!diagnostics}>
	<div class="actions">
		<Button variant="accent" disabled={!diagnostics} onclick={copy}>{t('errors.diag.copy')}</Button>
		<Button disabled={!diagnostics} onclick={download}>{t('errors.diag.download')}</Button>
		<!-- External GitHub link, not an app route. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			class="link-button"
			href={reportUrl}
			target="_blank"
			rel="noopener"
			aria-disabled={!diagnostics}
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<Icon name="report" /><span>{t('errors.diag.report')}</span>
		</a>
		<Button variant="quiet" onclick={gather}>{t('errors.diag.refresh')}</Button>
	</div>

	<section>
		<h2>{t('errors.diag.problems')}</h2>
		<div class="row-line">
			<span>
				{errorLog.entries.length === 0
					? t('common.none')
					: t('errors.diag.problemCount', { count: errorLog.entries.length })}
			</span>
			<Button
				variant="quiet"
				disabled={errorLog.entries.length === 0}
				onclick={() => errorLog.showDetails()}>{t('errors.details')}</Button
			>
		</div>
	</section>

	{#each diagnostics?.sections ?? [] as section (section.id)}
		<section data-section={section.id}>
			<h2>{label(section.title)}</h2>
			<dl>
				{#each section.rows as row (row.label)}
					<dt>{label(row.label)}</dt>
					<dd>{row.value}</dd>
				{/each}
			</dl>
			{#if section.id === 'storage'}
				<Button variant="quiet" href={resolve('/settings')}>{t('errors.diag.manageData')}</Button>
			{/if}
		</section>
	{/each}
</div>

<style>
	.panel {
		display: grid;
		gap: var(--space-4);
	}
	.actions,
	.row-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.row-line {
		justify-content: space-between;
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(8rem, max-content) 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		font-size: 0.85rem;
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border-radius: var(--button-radius);
		background: var(--button-background);
		color: var(--button-color);
		font: var(--button-font);
		letter-spacing: 0.04em;
		text-decoration: none;
	}
	.link-button[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.5;
	}
	.link-button:hover {
		filter: brightness(1.15);
	}
</style>
