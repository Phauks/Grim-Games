<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { historyItems, historyStage, itemSeats, type HistoryItem } from './history.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { gameStarts, nightStarts } from '#lib/features/board/device-notes.ts';
	import { phaseText } from '#lib/features/game/phase-text.ts';
	import HistoryLine from './HistoryLine.svelte';
	import type { SeatId } from '#lib/core/model/index.ts';

	interface Props {
		open?: boolean;
		grimoire: Grimoire;
		/**
		 * In the Storyteller's pane, beside the board, rather than over it (Trevor, 2026-11-18:
		 * "make it populate in the right sidebar, so that you can see both at the same time").
		 */
		inline?: boolean;
	}

	let { open = $bindable(false), grimoire, inline = false }: Props = $props();
	/** Shown: in the pane, whenever the view is; otherwise while the dialog is open. */
	const visible = $derived(inline || open);

	const characters = $derived(grimoire.open.characters);
	const cursor = $derived(grimoire.open.session.log.cursor);
	const viewOnly = $derived(grimoire.open.viewOnly);
	const savedCursor = $derived(grimoire.open.savedCursor);
	// Only built while open: it replays the whole log.
	const items = $derived(
		visible ? historyItems(grimoire.open.session.log.entries, cursor, characters) : []
	);
	// ── Filter by player (Trevor, 2026-10-19; by character before, 2026-10-16): any of those
	// chosen, in a fixed row. A seat stays one player when its character changes, and two
	// seats with the same character stay two. ──
	let chosenSeats = $state<SeatId[]>([]);
	$effect(() => {
		if (!visible) chosenSeats = [];
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
	/** The shown lines by the stage they were made in, newest stage first (historyStage). */
	const stages = $derived.by(() => {
		const gameId = grimoire.game.gameId;
		const starts = { game: gameStarts.read(gameId), nights: nightStarts.read(gameId) };
		const out: { key: string; title: string; items: HistoryItem[] }[] = [];
		for (const item of shown) {
			const title = phaseText(historyStage(item, starts));
			const last = out.at(-1);
			if (last?.title === title) last.items.push(item);
			else out.push({ key: `${out.length}:${title}`, title, items: [item] });
		}
		return out;
	});
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

{#snippet body()}
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
	<!-- By stage, newest first, each a gold band as the Day's sections (Trevor, 2026-11-19). -->
	<div class="history">
		{#each stages as stage (stage.key)}
			<Collapsible band="fill" title={stage.title} count={stage.items.length}>
				<ol class="lines">
					{#each stage.items as item (item.cursor)}{@render line(item)}{/each}
				</ol>
			</Collapsible>
		{:else}
			<NoneState />
		{/each}
	</div>
{/snippet}

{#snippet line(item: HistoryItem)}
	<li class:undone={item.undone} class:now={item.cursor === cursor}>
		<span class="number"><CountBadge count={item.number} testid="history-number" /></span>
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
			<!-- The restore-history symbol, not the word (Trevor, 2026-11-19). -->
			<IconButton icon="restore" label="Restore" onclick={() => choose(item)} />
		{/if}
	</li>
{/snippet}

{#if inline}<div class="inline" data-testid="history">{@render body()}</div>{:else}<Dialog
		bind:open
		title="History"
		size="full">{@render body()}</Dialog
	>{/if}

<ConfirmDialog bind:open={confirmOpen} title="Restore?" onConfirm={confirm}>
	{#if chosen}
		<p>
			{chosen.item.undone ? 'Restore' : 'Undo'}
			{changes}
			{changes === 1 ? 'change' : 'changes'}, {chosen.item.undone
				? 'up to and including'
				: 'back to just before'}:
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
	/* In the pane: the filter row stays, the list scrolls in its own part. The gutter is
	   inside the scroll box, so the stages' bands reach into it uncut (Trevor, 2026-11-19). */
	.inline {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.inline .filter {
		margin-inline: var(--pane-gutter, 0rem);
	}
	.inline .history {
		padding-inline: var(--pane-gutter, 0rem);
	}
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
	.history {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		flex: 1;
		min-height: 0;
		padding-block: var(--space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.lines {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		/* A fixed number column, so three-digit numbers don't shift the text (Trevor: no reflow). */
		grid-template-columns: 2em 1fr auto;
		grid-template-areas: 'number text action' 'number when action';
		align-items: center;
		column-gap: var(--space-2);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.number {
		grid-area: number;
		font-size: 0.8rem;
	}
	li.undone .number {
		opacity: 0.5;
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
