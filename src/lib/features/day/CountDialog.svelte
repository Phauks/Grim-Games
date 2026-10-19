<script lang="ts">
	import { alignmentOf, type Game } from '#lib/core/model/index.ts';
	import { blockThreshold, counts, seatsBehind, type DayCount } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * How one of the day's top counts was worked out (Trevor, 2026-10-19: "show how they were
	 * calculated"), as a table: the seats behind it and whether each adds one, or for the
	 * votes, the living players and half of them rounded up. Storyteller only.
	 */
	interface Props {
		open: boolean;
		game: Game;
		count: DayCount | 'votes' | undefined;
		/** The dialog's title: the count's own accessible name. */
		title: string;
	}

	let { open = $bindable(), game, count, title }: Props = $props();

	const block = $derived(blockThreshold(game));
	const seats = $derived(count && count !== 'votes' ? seatsBehind(game, count) : []);
	const total = $derived(
		count && count !== 'votes' ? seats.filter((s) => counts(game, count, s)).length : 0
	);
	/** The third column, where a seat can be in the list without adding one. */
	const status = $derived(
		count === 'alive'
			? (seatId: string) => t(game.seats[seatId].dead ? 'day.count.dead' : 'day.count.alive')
			: count === 'ghostVotes'
				? (seatId: string) =>
						t(game.seats[seatId].ghostVoteUsed ? 'day.count.used' : 'day.count.unused')
				: undefined
	);
</script>

<Dialog bind:open {title}>
	{#if count === 'votes'}
		<table class="count" data-testid="count-table">
			<tbody>
				<tr>
					<th scope="row">{t('day.count.living')}</th>
					<td>{block.alive}</td>
				</tr>
				<tr>
					<th scope="row">{t('day.count.half')}</th>
					<td>{block.needed}</td>
				</tr>
			</tbody>
		</table>
	{:else if count}
		<table class="count" data-testid="count-table">
			<thead>
				<tr>
					<th scope="col">{t('day.count.player')}</th>
					<th scope="col">{t('day.count.character')}</th>
					{#if status}<th scope="col"
							>{t(count === 'alive' ? 'day.count.status' : 'day.count.ghostVote')}</th
						>{/if}
				</tr>
			</thead>
			<tbody>
				{#each seats as seatId (seatId)}
					{@const seat = game.seats[seatId]}
					<tr data-seat={seatId} data-counts={counts(game, count, seatId) || undefined}>
						<td>{seatLabel(game, seatId)}</td>
						<td
							>{#if seat.characterId}<CharacterBadge
									characterId={seat.characterId}
									alignment={alignmentOf(game, seatId)}
									inline
								/>{:else}{t('common.none')}{/if}</td
						>
						{#if status}<td>{status(seatId)}</td>{/if}
					</tr>
				{:else}
					<tr><td colspan={status ? 3 : 2}>{t('common.none')}</td></tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row" colspan={status ? 2 : 1}>{t('day.count.total')}</th>
					<td>{total}</td>
				</tr>
			</tfoot>
		</table>
	{/if}
</Dialog>

<style>
	.count {
		width: 100%;
		border-collapse: collapse;
	}
	.count th {
		color: var(--on-surface-muted);
		font-weight: normal;
		text-align: left;
	}
	.count th,
	.count td {
		padding: var(--space-1) var(--space-2) var(--space-1) 0;
		vertical-align: middle;
	}
	tbody tr + tr,
	tfoot tr {
		border-top: 1px solid var(--border);
	}
	/* A seat listed but not adding one (dead, or its ghost vote spent) reads quieter. */
	tr[data-seat]:not([data-counts]) td {
		color: var(--on-surface-muted);
	}
</style>
