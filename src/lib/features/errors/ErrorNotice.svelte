<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import { errorDetails, type AppError } from './app-error.ts';
	import { errorLog } from './report.svelte.ts';

	// The corner card plus the details dialog; mounted once by install.ts, outside the layout.

	let confirmClear = $state(false);
	const latest = $derived(errorLog.entries.find((e) => e.key === errorLog.unseen[0]));
	const time = $derived(new Intl.DateTimeFormat(locale.current, { timeStyle: 'short' }));

	function report(error: AppError) {
		reportDialog.show({
			kind: 'bug',
			title: `${error.name}: ${error.message}`.slice(0, 120),
			details: errorDetails(error)
		});
	}

	async function copy(error: AppError) {
		await copyText(errorDetails(error), {
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

<Dialog bind:open={errorLog.open} title={t('errors.dialogTitle')}>
	{#if errorLog.entries.length === 0}
		<p class="none">{t('common.none')}</p>
	{:else}
		<ol class="log">
			{#each errorLog.entries as error (error.key)}
				<li>
					<p class="message"><strong>{error.name}</strong>: {error.message}</p>
					<p class="meta">
						{error.count > 1
							? t('errors.metaRepeated', {
									area: error.area,
									page: error.page,
									time: time.format(error.lastAt),
									count: error.count
								})
							: t('errors.meta', {
									area: error.area,
									page: error.page,
									time: time.format(error.lastAt)
								})}
					</p>
					<div class="row-actions">
						<Button variant="quiet" onclick={() => copy(error)}>{t('errors.copy')}</Button>
						<Button variant="quiet" onclick={() => report(error)}
							><Icon name="report" />{t('errors.report')}</Button
						>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
	<!-- The trash sits beside the X (Trevor, 2026-10-17). -->
	{#snippet headActions()}
		<DeleteButton
			label={t('errors.clear')}
			disabled={errorLog.entries.length === 0}
			onclick={() => (confirmClear = true)}
		/>
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
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.log {
		display: grid;
		gap: var(--space-3);
		max-height: 60vh;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}
	.log li {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.message,
	.meta {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.meta {
		color: var(--on-surface-muted);
		font-size: 0.8rem;
	}
	.row-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
