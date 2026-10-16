<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { groupByType, matchesReference, type ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { activeFilterCount, tableRows } from '#lib/core/rules/reference-table.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable from './CharacterTable.svelte';
	import { TYPE_PLURALS } from './labels.ts';
	import ReferenceCard from './ReferenceCard.svelte';
	import { referenceTable } from './table-state.svelte.ts';
	import type { ReferenceView } from './view-mode.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		view: ReferenceView;
	}

	let { entries, view }: Props = $props();

	// One shared details overlay, so extra detail never expands a card or row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// Search is the one filter for cards; the table adds its own per-column filters.
	let search = $state('');
	let searchInput = $state<HTMLInputElement>();

	// Keyboard comforts on a computer: "/" jumps to the search field, Esc clears it.
	function onWindowKey(event: KeyboardEvent) {
		if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
		event.preventDefault();
		searchInput?.focus();
	}
	function onSearchKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && search) {
			event.preventDefault();
			search = '';
		}
	}
	const shown = $derived(entries.filter((e) => matchesReference(e, { search })));
	const groups = $derived(groupByType(shown));
	// The table's own column filters and sort apply on top of the search.
	const rows = $derived(view === 'table' ? tableRows(shown, referenceTable.current) : []);
	const filters = $derived(activeFilterCount(referenceTable.current.filters));
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="controls">
	<label class="search">
		<span class="visually-hidden">{t('reference.searchLabel')}</span>
		<Icon name="search" />
		<input
			type="search"
			placeholder={t('reference.searchPlaceholder')}
			autocomplete="off"
			aria-keyshortcuts="/"
			bind:this={searchInput}
			bind:value={search}
			onkeydown={onSearchKey}
		/>
	</label>
	{#if view === 'cards'}
		<p class="count" aria-live="polite">
			{t('reference.count', { shown: shown.length, count: entries.length })}
		</p>
	{:else}
		<!-- The table's count and Clear sit on the search line, not a line of their own. -->
		<div class="table-count">
			<p class="count" aria-live="polite" data-testid="table-count">
				{t('reference.tableCount', {
					shown: rows.length,
					total: entries.length,
					filters:
						filters === 0 ? t('reference.noFilters') : t('reference.filters', { count: filters })
				})}
			</p>
			<Button
				variant="quiet"
				icon="close"
				disabled={filters === 0}
				onclick={() => referenceTable.clearFilters()}>{t('reference.clearFilters')}</Button
			>
		</div>
	{/if}
</div>

{#if view === 'table'}
	<CharacterTable {rows} onExplain={explain} />
{:else}
	{#each groups as group (group.type)}
		<!-- Each character type folds away under its caret (Trevor, 2026-10-16); a search shows
		     every match. -->
		<div class="group">
			<Collapsible
				title={TYPE_PLURALS[group.type]}
				tone={group.type === 'townsfolk' || group.type === 'outsider'
					? 'good'
					: group.type === 'minion' || group.type === 'demon'
						? 'evil'
						: undefined}
				storageKey="reference:{group.type}"
				forceOpen={search.trim() !== ''}
			>
				{#snippet aside()}<span class="group-count">({group.entries.length})</span>{/snippet}
				<div class="cards">
					{#each group.entries as entry (entry.character.id)}
						<ReferenceCard {entry} onExplain={explain} />
					{/each}
				</div>
			</Collapsible>
		</div>
	{:else}
		<p class="empty">{t('reference.noMatch')}</p>
	{/each}
{/if}

<Dialog bind:open={detailsOpen} title={details?.title ?? ''}>
	{#snippet heading()}
		<Sentence text={details?.title ?? ''}
			>{#snippet fill()}{#if details?.character}<CharacterBadge
						characterId={details.character.id}
						character={details.character}
						inline
					/>{/if}{/snippet}</Sentence
		>
	{/snippet}
	{#if details}<p>{details.text}</p>{/if}
</Dialog>

<style>
	.controls {
		display: grid;
		/* minmax(0, …): the search field shrinks to the screen instead of widening the page. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		margin-bottom: var(--space-5);
	}
	/* On a wider screen the search field stops at a readable width, with the count beside it. */
	@media (min-width: 48rem) {
		.controls {
			grid-template-columns: minmax(0, calc(36 * var(--u))) auto;
			align-items: center;
		}
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: var(--card-background);
		color: var(--on-surface-muted);
	}
	/* One focus mark, on the field's own rounded border, drawn inside so nothing clips it;
	   the input's ring is off (Trevor, 2026-10-16: no double halo). */
	.search:focus-within {
		border-color: var(--focus);
		box-shadow: inset 0 0 0 calc(0.0625 * var(--u)) var(--focus);
	}
	.search input:focus-visible {
		outline: none;
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		border: 0;
		outline: none;
		background: none;
		color: var(--on-surface);
		/* 16px or more stops iOS zooming into the field. */
		font: inherit;
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.table-count {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.group {
		margin-bottom: var(--space-6);
	}
	.group-count {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	/* Long cards: one per row on a laptop or desktop, so each lays its fields out side by side
	   rather than in a tall stack (Trevor, 2026-10-16); two on the widest screens. */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(36 * var(--u))), 1fr));
		gap: var(--space-3);
		align-items: start;
	}
	.empty {
		color: var(--on-surface-muted);
	}
</style>
