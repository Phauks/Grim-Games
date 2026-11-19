<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import SeatNotes from './SeatNotes.svelte';
	import { tablePlayers, type TableEntry } from './table-entries.ts';

	/**
	 * Every player's notes, one section each in seat order, for a Notes view of its own under
	 * Players (Trevor, 2026-11-18: "separate notes and messages from players").
	 */
	interface Props {
		game: OpenGame;
		run?: (command: Command) => boolean;
	}

	let { game, run }: Props = $props();

	const host = roomHost();
	// A row's title names it for Collapsible only; its label shows the name as a badge.
	// eslint-disable-next-line grim/names-as-badges -- never shown, the label replaces it
	const titleOf = (entry: TableEntry): string => entry.name;
	const players = $derived(tablePlayers(game, host));
	const count = (seatId: string) => game.game.seats[seatId]?.notes?.length ?? 0;
</script>

{#if players.length === 0}
	<p class="none">{t('common.none')}</p>
{:else}
	<div class="notes" data-testid="player-notes-list">
		{#each players as entry (entry.key)}
			{@const seatId = entry.seatId!}
			<Collapsible
				title={titleOf(entry)}
				level={3}
				pinned={false}
				count={count(seatId)}
				empty={count(seatId) === 0}
				lazy
			>
				{#snippet label()}<PlayerBadge name={entry.name} />{/snippet}
				<SeatNotes {game} {seatId} {run} />
			</Collapsible>
		{/each}
	</div>
{/if}

<style>
	.notes {
		display: grid;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
