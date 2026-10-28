<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { historyItems, itemSeats, type HistoryItem } from './history.ts';
	import HistoryLine from './HistoryLine.svelte';
	import type { SeatId } from '#lib/core/model/index.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const cursor = $derived(grimoire.open.session.log.cursor);
	const viewOnly = $derived(grimoire.open.viewOnly);
	const savedCursor = $derived(grimoire.open.savedCursor);
	// Only built while open: it replays the whole log.
	const items = $derived(
		open ? historyItems(grimoire.open.session.log.entries, cursor, characters) : []
	);
	// ── Filter by player (Trevor, 2026-10-19; by character before, 2026-10-16): any of those
	// chosen, in a fixed row. A seat stays one player when its character changes, and two
	// seats with the same character stay two. ──
	let chosenSeats = $state<SeatId[]>([]);
	$effect(() => {
		if (!open) chosenSeats = [];
	});
	/** Every seat History names: in seating order, then seats since removed. */
	const named = $derived.by(() => {
		const all = new Set(items.flatMap(itemSeats));
		const seated = grimoire.game.seating.filter((id) => all.has(id));
		return [...seated, ...[...all].filter((id) => !seated.includes(id))];
	});
	/** A seat's name now, or the newest name History has for a removed seat. */
	function seatLabel(seatId: SeatId): PlayerName {
		const game = grimoire.game;
		const number = game.seating.indexOf(seatId) + 1;
		if (number > 0) return game.seats[seatId]?.playerName ?? t('common.seat', { number });
		for (const item of items)
			for (const part of item.parts)
				if (part.kind === 'seat' && part.seatId === seatId) return part.name;
		return 'A seat';
	}
	const shown = $derived(
		chosenSeats.length === 0
			? items
			: items.filter((item) => itemSeats(item).some((id) => chosenSeats.includes(id)))
	);
	function toggleFilter(id: SeatId) {
		chosenSeats = chosenSeats.includes(id)
			? chosenSeats.filter((c) => c !== id)
			: [...chosenSeats, id];
	}
	const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

	/** The entry the Storyteller tapped, and where the game would go. */
	let chosen = $state<{ item: HistoryItem; to: number } | undefined>();
	let confirmOpen = $state(false);
	const changes = $derived(chosen ? Math.abs(cursor - chosen.to) : 0);

	function choose(item: HistoryItem) {
		// An applied entry rolls back to just before it; an undone one restores up to it.
		// An ended game only shows the board just after that entry: nothing to confirm.
		if (viewOnly) return grimoire.open.goTo(item.cursor);
		chosen = { item, to: item.undone ? item.cursor : item.cursor - 1 };
		confirmOpen = true;
	}

	function confirm() {
		confirmOpen = false;
		if (chosen) grimoire.open.goTo(chosen.to);
		chosen = undefined;
	}
</script>

<Dialog bind:open title="History" size="full">
	<div class="filter" role="group" aria-label="Show changes for">
		<button
			type="button"
			class="all"
			aria-pressed={chosenSeats.length === 0}
			onclick={() => (chosenSeats = [])}>All</button
		>
		{#each named as id (id)}
			<button
				type="button"
				class="who"
				aria-pressed={chosenSeats.includes(id)}
				onclick={() => toggleFilter(id)}><PlayerBadge name={seatLabel(id)} /></button
			>
		{/each}
	</div>
	<ol class="history">
		{#each shown as item (item.cursor)}
			<li class:undone={item.undone} class:now={item.cursor === cursor}>
				<span class="text"><HistoryLine parts={item.parts} {characters} /></span>
				<span class="when">
					{item.cursor === cursor
						? viewOnly
							? 'Shown · '
							: 'Now · '
						: item.cursor > savedCursor
							? 'Undone · '
							: item.undone
								? 'Later · '
								: ''}{time.format(item.at)}
				</span>
				{#if viewOnly}
					<Button
						variant="quiet"
						disabled={item.cursor === cursor || item.cursor > savedCursor}
						onclick={() => choose(item)}>Show</Button
					>
				{:else if item.cursor > 1}
					<Button variant="quiet" onclick={() => choose(item)}>Restore</Button>
				{/if}
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ol>
</Dialog>

<ConfirmDialog bind:open={confirmOpen} title="Restore?" onConfirm={confirm}>
	{#if chosen}
		<p>
			{chosen.item.undone ? 'Restores' : 'Undoes'}
			{changes}
			{changes === 1 ? 'change' : 'changes'}, up to {chosen.item.undone
				? 'and including'
				: 'just before'}:
		</p>
		<p class="target"><HistoryLine parts={chosen.item.parts} {characters} /></p>
		<p class="note">
			{chosen.item.undone
				? 'Restored changes are applied again.'
				: 'Undone changes stay in History, greyed out, until you make a new change.'}
		</p>
	{/if}
</ConfirmDialog>

<style>
	/* One fixed row, scrolled sideways, so filtering never moves the list (Trevor). */
	.filter {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: none;
		height: calc(var(--tap-target) + var(--space-2));
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--border);
	}
	.filter button {
		flex: none;
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-full);
		background: none;
		color: inherit;
		font: 600 0.85rem var(--font-control);
		cursor: pointer;
	}
	.filter .who {
		max-width: 12em;
	}
	.filter button[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.none {
		display: block;
		color: var(--on-surface-muted);
	}
	.history {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'text action' 'when action';
		align-items: center;
		column-gap: var(--space-2);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.text {
		grid-area: text;
		line-height: 1.9;
	}
	.when {
		grid-area: when;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	li :global(button) {
		grid-area: action;
	}
	li.now .when {
		color: var(--accent);
	}
	li.undone .text {
		opacity: 0.5;
		text-decoration: line-through;
	}
	p {
		margin: 0 0 var(--space-2);
	}
	.target {
		line-height: 1.9;
	}
	.note {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>
