<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import { errorDetails, type AppError } from './app-error.ts';
	import { errorLog } from './report.svelte.ts';

	// The corner card plus every problem on this device in one table (Trevor, 2026-10-18); a
	// row opens its details over it. Mounted once by install.ts, outside the layout.

	let confirmClear = $state(false);
	let openKey = $state<string>();
	let detailsOpen = $state(false);
	const latest = $derived(errorLog.entries.find((e) => e.key === errorLog.unseen[0]));
	const current = $derived(errorLog.entries.find((e) => e.key === openKey));
	const time = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'short', timeStyle: 'short' })
	);
	const clock = $derived(new Intl.DateTimeFormat(locale.current, { timeStyle: 'short' }));
	const day = $derived(new Intl.DateTimeFormat(locale.current, { dateStyle: 'short' }));
	/** The table's Last seen: the time for today's problems, else the date (details have both). */
	function seen(at: number): string {
		return new Date(at).toDateString() === new Date().toDateString()
			? clock.format(at)
			: day.format(at);
	}

	type Column = 'problem' | 'area' | 'page' | 'last' | 'count';
	const columns = $derived<DataColumn<Column, AppError>[]>([
		{
			id: 'problem',
			label: t('errors.problem'),
			rowHeader: true,
			flush: true,
			value: (e) => `${e.name}: ${e.message}`
		},
		{
			id: 'area',
			flush: true,
			label: t('errors.area'),
			width: '14%',
			wide: true,
			value: (e) => e.area
		},
		{
			id: 'page',
			flush: true,
			label: t('errors.page'),
			width: '16%',
			wide: true,
			value: (e) => e.page
		},
		{ id: 'last', flush: true, label: t('errors.lastSeen'), width: '24%', value: (e) => e.lastAt },
		{
			id: 'count',
			flush: true,
			label: t('errors.times'),
			width: '16%',
			align: 'end',
			value: (e) => e.count
		}
	]);

	function open(error: AppError) {
		openKey = error.key;
		detailsOpen = true;
	}

	function report(error: AppError) {
		reportDialog.show({
			kind: 'bug',
			title: `${error.name}: ${error.message}`.slice(0, 120),
			details: errorDetails(error)
		});
	}

	async function copy(errors: AppError[]) {
		await copyText(errors.map(errorDetails).join('\n\n'), {
			copied: [t('errors.copied'), t('errors.copiedDetail')],
			failed: [t('errors.copyFailed'), t('errors.copyFailedDetail')]
		});
	}
</script>

{#if latest}
	<!-- A small card over the page (no reflow, no focus steal): it never interrupts a game. -->
	<div class="notice" role="status" data-testid="error-notice">
		<Icon name="warning" />
		<p class="text">
			<strong>
				{errorLog.unseen.length > 1
					? t('errors.somethingWentWrongCount', { count: errorLog.unseen.length })
					: t('errors.somethingWentWrong')}
			</strong>
			<span>{latest.message}</span>
		</p>
		<Button variant="quiet" onclick={() => errorLog.showDetails()}>{t('errors.details')}</Button>
		<IconButton icon="close" label={t('errors.dismiss')} onclick={() => errorLog.dismiss()} />
	</div>
{/if}

<Dialog bind:open={errorLog.open} title={t('errors.dialogTitle')} size="full">
	<DataTable
		label={t('errors.dialogTitle')}
		{columns}
		rows={errorLog.entries}
		key={(e) => e.key}
		narrow="hide"
		fit="container"
		hideKey="error-log"
		testid="problems"
	>
		{#snippet cell(error, column)}
			<!-- Every cell is a button for the same problem, so a tap anywhere on the row opens
			     its details; only the first is in the tab order. -->
			<button
				type="button"
				class="open"
				class:end={column.align === 'end'}
				tabindex={column.id === 'problem' ? undefined : -1}
				onclick={() => open(error)}
			>
				{#if column.id === 'problem'}
					<strong>{error.name}</strong>: {error.message}
				{:else if column.id === 'area'}
					{error.area}
				{:else if column.id === 'page'}
					{error.page}
				{:else if column.id === 'last'}
					{seen(error.lastAt)}
				{:else}
					{error.count}
				{/if}
			</button>
		{/snippet}
	</DataTable>
	<!-- Copy and the trash sit beside the X (Trevor, 2026-10-17). -->
	{#snippet headActions()}
		<IconButton
			icon="copy"
			label={t('errors.copyAll')}
			disabled={errorLog.entries.length === 0}
			onclick={() => copy(errorLog.entries)}
		/>
		<DeleteButton
			label={t('errors.clear')}
			disabled={errorLog.entries.length === 0}
			onclick={() => (confirmClear = true)}
		/>
	{/snippet}
</Dialog>

<Dialog bind:open={detailsOpen} title={current ? current.name : t('errors.dialogTitle')}>
	{#if current}
		<p class="message">{current.message}</p>
		<dl class="facts">
			<dt>{t('errors.area')}</dt>
			<dd>{current.area}</dd>
			<dt>{t('errors.page')}</dt>
			<dd>{current.page}</dd>
			<dt>{t('errors.firstSeen')}</dt>
			<dd>{time.format(current.firstAt)}</dd>
			<dt>{t('errors.lastSeen')}</dt>
			<dd>{time.format(current.lastAt)}</dd>
			<dt>{t('errors.times')}</dt>
			<dd>{current.count}</dd>
		</dl>
		{#if current.stack}
			<pre class="stack">{current.stack}</pre>
		{/if}
	{/if}
	{#snippet actions()}
		<Button variant="quiet" disabled={!current} onclick={() => current && copy([current])}
			>{t('errors.copy')}</Button
		>
		<Button variant="quiet" disabled={!current} onclick={() => current && report(current)}
			><Icon name="report" />{t('errors.report')}</Button
		>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={confirmClear}
	title={t('errors.clearTitle')}
	danger
	onConfirm={() => errorLog.clear()}
/>

<style>
	.notice {
		position: fixed;
		/* Bottom-left on wide screens, top on phones: the update card and toasts use the bottom. */
		bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
		left: max(var(--space-3), env(safe-area-inset-left));
		z-index: var(--z-toast);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: min(calc(24 * var(--u)), calc(100vw - 2 * var(--space-3)));
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-left: 4px solid var(--accent);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
	}
	@media (max-width: 40rem) {
		.notice {
			top: calc(var(--space-3) + env(safe-area-inset-top));
			bottom: auto;
		}
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.text span {
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.open {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	.open.end {
		text-align: end;
	}
	:global([data-testid='problems'] tr:has(.open:hover)) {
		background: var(--surface-hover);
	}
	.message {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.facts {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: var(--space-3) 0 0;
	}
	.facts dt {
		color: var(--on-surface-muted);
	}
	.facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.stack {
		margin: var(--space-3) 0 0;
		padding: var(--space-2);
		overflow-x: auto;
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 0.75rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
