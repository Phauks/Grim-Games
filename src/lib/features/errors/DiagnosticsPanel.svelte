<script lang="ts">
	import { onMount } from 'svelte';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { diagnosticsView, refreshDiagnostics } from './diagnostics-view.svelte.ts';
	import { errorLog } from './report.svelte.ts';

	// Gathered on this device when the page opens; nothing is sent unless the person taps Report.

	interface Props {
		/** Rows already shown nearby (About's version and commit); still in the copied text. */
		hideRows?: readonly MessageKey[];
	}

	let { hideRows = [] }: Props = $props();

	const diagnostics = $derived(diagnosticsView.current);
	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);

	onMount(refreshDiagnostics);

	// Each part opens and closes from its heading, remembered on this device (Trevor, 2026-11-16).
	const KEY = 'about-diagnostics-';
</script>

<div class="panel" data-testid="diagnostics" aria-busy={!diagnostics}>
	<!-- Copy and Download are icons beside the Advanced heading (DiagnosticsActions); Report an
	     issue is in About's main part (Trevor, 2026-10-19). -->
	<PageSection
		title={t('errors.diag.problems')}
		level={3}
		collapsible
		storageKey="{KEY}problems"
		count={errorLog.entries.length}
	>
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
	</PageSection>

	{#each diagnostics?.sections ?? [] as section (section.id)}
		<PageSection
			title={label(section.title)}
			level={3}
			collapsible
			storageKey="{KEY}{section.id}"
		>
			<dl data-section={section.id}>
				{#each section.rows.filter((row) => !hideRows.includes(row.label)) as row (row.label)}
					<dt>{label(row.label)}</dt>
					<dd>
						{#if row.href}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub link -->
							<a href={row.href} target="_blank" rel="noopener">{row.value}</a>
						{:else}
							{row.value}
						{/if}
					</dd>
				{/each}
			</dl>
		</PageSection>
	{/each}
</div>

<style>
	/* The parts space themselves, as collapsible sections do on every page. */
	.panel {
		display: grid;
	}
	.row-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.row-line {
		justify-content: space-between;
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
	dd a {
		color: inherit;
	}
</style>
