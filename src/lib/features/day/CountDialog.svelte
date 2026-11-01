<script lang="ts">
	import { alignmentOf, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
	import {
		blockThreshold,
		counts,
		exileThreshold,
		seatsBehind,
		votesWithoutToken,
		type DayCount
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CountBadge from './CountBadge.svelte';

	/**
	 * How one of the day's top counts was worked out (Trevor, 2026-10-19: "show how they were
	 * calculated"), as a table: the seats behind it and whether each adds one, or for the
	 * votes, each threshold in its gold badge with a short line beside it (Trevor, 2026-11-01,
	 * option A: the joined sentences made too long a title). Storyteller only.
	 */
	interface Props {
		open: boolean;
		game: Game;
		characters: CharacterLookup;
		count: DayCount | 'votes' | undefined;
		/** The dialog's title: the count's own accessible name. */
		title: string;
	}

	let { open = $bindable(), game, characters, count, title }: Props = $props();

	const block = $derived(blockThreshold(game));
	/** Players to exile a Traveller, only while a living one is in play. */
	const exile = $derived(count === 'votes' ? exileThreshold(game, characters) : undefined);
	const seats = $derived(count && count !== 'votes' ? seatsBehind(game, count) : []);
	const total = $derived(
		count && count !== 'votes'
			? seats.reduce((sum, s) => sum + counts(game, count, s, characters), 0)
			: 0
	);
	/** The third column, where a seat can be in the list without adding one. */
	const status = $derived(
		count === 'alive'
			? (seatId: string) => t(game.seats[seatId].dead ? 'day.count.dead' : 'day.count.alive')
			: count === 'ghostVotes'
				? (seatId: string) => {
						// The Banshee killed by the Demon votes twice with no token (`afterDeath`).
						const votes = votesWithoutToken(game, seatId, characters);
						if (votes !== undefined) return t('day.count.noToken', { count: votes });
						return t(game.seats[seatId].ghostVoteUsed ? 'day.count.used' : 'day.count.unused');
					}
				: undefined
	);
</script>

<Dialog bind:open {title}>
	{#if count === 'votes'}
		<ul class="votes" data-testid="count-votes">
			<li>
				<span class="badge"
					><CountBadge kind="votes" label={t('day.blockLine', { alive: block.alive })}
						><Icon name="vote" />{block.needed}</CountBadge
					></span
				><span>{t('day.blockLine', { alive: block.alive })}</span>
			</li>
			{#if exile !== undefined}
				<li>
					<span class="badge"
						><CountBadge kind="votes" label={t('day.exileLine', { total: game.seating.length })}
							><Icon name="exile" />{exile}</CountBadge
						></span
					><span>{t('day.exileLine', { total: game.seating.length })}</span>
				</li>
			{/if}
		</ul>
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
					<tr data-seat={seatId} data-counts={counts(game, count, seatId, characters) || undefined}>
						<td><PlayerBadge name={seatName(game, seatId)} /></td>
						<td
							>{#if seat.characterId}<CharacterBadge
									characterId={seat.characterId}
									alignment={alignmentOf(game, seatId)}
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
	.votes {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.votes li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* Each badge the width of one of the day row's cells, so both line up. */
	.badge {
		display: inline-flex;
		flex-shrink: 0;
		container-type: inline-size;
		inline-size: calc(var(--tap-target) * 1.6);
	}
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
	tbody tr + tr {
		border-top: 1px solid var(--border);
	}
	/* Column names read as headings and the total as a sum (Trevor, 2026-10-19): headings in
	   the heading colour over a heavier rule, the total bold under the same rule. */
	.count thead th {
		padding-bottom: var(--space-2);
		border-bottom: 2px solid var(--heading); /* px-ok: a rule's thickness */
		color: var(--heading);
		font-weight: bold;
	}
	tfoot tr {
		border-top: 2px solid var(--heading); /* px-ok: a rule's thickness */
	}
	.count tfoot th,
	.count tfoot td {
		padding-top: var(--space-2);
		color: var(--on-surface);
		font-weight: bold;
	}
	/* A seat listed but not adding one (dead, or its ghost vote spent) reads quieter. */
	tr[data-seat]:not([data-counts]) td {
		color: var(--on-surface-muted);
	}
</style>
