<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { reportOutbox } from './outbox.svelte.ts';

	// What this device has sent, and what waits for a connection (Trevor, 2026-10-27), so a
	// report filed offline can be seen waiting and then sent.

	const rows = $derived([
		...reportOutbox.waiting.map((w) => ({
			sendId: w.sendId,
			title: w.draft.title,
			status: t('reports.outbox.waiting'),
			waiting: true
		})),
		...reportOutbox.sent.map((s) => ({
			sendId: s.sendId,
			title: s.title,
			status:
				s.id === undefined ? t('reports.outbox.refused') : t('reports.outbox.sent', { id: s.id }),
			waiting: false
		}))
	]);
</script>

{#if rows.length > 0}
	<Collapsible title={t('reports.outbox')} level={3} storageKey="report-outbox" count={rows.length}>
		<ul class="outbox" data-testid="report-outbox">
			{#each rows as row (row.sendId)}
				<li class:waiting={row.waiting}>
					<span class="title">{row.title}</span>
					<span class="status">{row.status}</span>
				</li>
			{/each}
		</ul>
	</Collapsible>
{/if}

<style>
	.outbox {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}
	.outbox li {
		display: flex;
		gap: var(--space-3);
		justify-content: space-between;
		padding: var(--space-2) 0;
	}
	.outbox li + li {
		border-top: 1px solid var(--border);
	}
	.title {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.status {
		flex: none;
		color: var(--on-surface-muted);
	}
	.waiting .status {
		color: var(--on-surface);
	}
</style>
