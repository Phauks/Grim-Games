<script lang="ts">
	import type { GameData } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { scriptPageUrl } from './botcscripts-api.ts';
	import { botcCard } from './botcscripts-cards.ts';
	import type { PickerRow } from './picker-rows.ts';

	/**
	 * A script's characters, before it is loaded (Trevor, 2026-10-16: "see what characters
	 * would be on the script before adding it"). Nothing changes until Load is tapped.
	 */
	interface Props {
		open: boolean;
		row: PickerRow | undefined;
		data: GameData | undefined;
		disabled?: boolean;
		onload: () => void;
	}

	let { open = $bindable(), row, data, disabled = false, onload }: Props = $props();

	const card = $derived(row && data ? botcCard(row.entries, data) : undefined);
</script>

<Dialog bind:open title={row?.name || t('scripts.current.defaultName')} size="full">
	{#if row}
		<dl class="facts">
			<dt>{t('scripts.botc.author')}</dt>
			<dd>{row.author || t('common.none')}</dd>
			<dt>{t('scripts.botc.type')}</dt>
			<dd>{t(`scripts.kind.${row.kind}`)}</dd>
			{#if row.source === 'botc'}
				<dt>{t('scripts.botc.version')}</dt>
				<dd>{row.version ?? t('common.none')}</dd>
				<dt>{t('scripts.botc.votesLabel')}</dt>
				<dd>{row.likes ?? 0}</dd>
			{:else}
				<dt>{t('scripts.current.source')}</dt>
				<dd>{row.note || t(`scripts.sourceLabel.${row.source}`)}</dd>
			{/if}
		</dl>
		<div class="groups" data-testid="script-preview">
			{#each card?.groups ?? [] as group (group.type ?? 'unknown')}
				<section>
					<h3>
						{group.type ? TYPE_PLURALS[group.type] : t('scripts.botc.unknownType')}
						<span class="count">{group.characters.length}</span>
					</h3>
					<p class="badges">
						{#each group.characters as c (c.id)}
							{#if c.official}
								<CharacterBadge characterId={c.official.id} inline />
							{:else}
								<span class="homebrew">{c.name}</span>
							{/if}
						{/each}
					</p>
				</section>
			{:else}
				<p class="muted">{t('common.none')}</p>
			{/each}
		</div>
	{/if}
	{#snippet actions()}
		{#if row?.source === 'botc' && row.number !== undefined}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="external"
				href={scriptPageUrl(row.number, row.version)}
				target="_blank"
				rel="noopener noreferrer">{t('scripts.botc.open')}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		<Button
			variant="accent"
			{disabled}
			onclick={() => {
				open = false;
				onload();
			}}>{t('scripts.picker.load')}</Button
		>
	{/snippet}
</Dialog>

<style>
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: var(--space-3) 0;
	}
	.facts dt {
		color: var(--on-surface-muted);
	}
	.facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.groups {
		display: grid;
		gap: var(--space-3);
		overflow-y: auto;
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	.count {
		color: var(--on-surface-muted);
		font-weight: 400;
	}
	.badges {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		align-items: center;
	}
	.homebrew {
		padding: 0 var(--space-1);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.external {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		margin-right: auto;
	}
</style>
