<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CopyButton from '#lib/ui/share/CopyButton.svelte';
	import { importLog } from './import-log.svelte.ts';

	/**
	 * The last import's log, step by step (Trevor, 2026-11-06, picked from the mockup): opened
	 * from Read log in the photo review, a window of its own so the review never moves. Each
	 * line's mark says how it went: found, a close match, not matched, or failed.
	 */
	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
</script>

<Dialog bind:open title={t('scripts.photo.logTitle')} size="full">
	{#snippet headActions()}
		<CopyButton
			label={t('scripts.photo.copyLog')}
			text={open ? importLog.text() : undefined}
			failed={t('scripts.photo.copyLogFailed')}
		/>
	{/snippet}
	{#if importLog.entries.length}
		<ol class="log" data-testid="import-log">
			{#each importLog.entries as entry, i (i)}
				<li data-tone={entry.tone}>
					<span class="at">+{(entry.at / 1000).toFixed(1)}s</span>
					<span class="text">{entry.text}</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="none">{t('common.none')}</p>
	{/if}
</Dialog>

<style>
	.log {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-code);
		font-size: 0.8rem;
	}
	li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2);
		padding-inline-start: var(--space-2);
		border-inline-start: 0.2rem solid transparent;
		overflow-wrap: anywhere;
	}
	li[data-tone='found'] {
		border-color: var(--good);
	}
	li[data-tone='close'] {
		border-color: var(--accent);
	}
	li[data-tone='missed'],
	li[data-tone='failed'] {
		border-color: var(--evil);
	}
	li[data-tone='failed'] .text {
		font-weight: 700;
	}
	.at {
		color: var(--on-surface-muted);
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
