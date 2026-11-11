<script lang="ts">
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import {
		blockThreshold,
		counts,
		exileThreshold,
		seatsBehind,
		votesWithoutToken,
		type DayCount
	} from '#lib/core/rules/day/voting.ts';
	import { votesSecret } from '#lib/core/rules/day/voting-table.ts';
	import { voteNotes, type VoteHint } from '#lib/core/rules/day/vote-weights.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
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

	const block = $derived(blockThreshold(game, characters));
	/** Players to exile a Traveller, only while a living one is in play. */
	const exile = $derived(count === 'votes' ? exileThreshold(game, characters) : undefined);
	const blockLine = $derived(
		block.mostVotes ? t('day.count.mostVotes') : t('day.blockLine', { alive: block.alive })
	);
	/** Seats whose vote is unusual today; the Storyteller counts the votes (M9e). */
	const notes = $derived(count === 'votes' ? voteNotes(game, characters) : []);
	const secret = $derived(count === 'votes' && votesSecret(game, characters));
	const noteLines = (hint: VoteHint): string[] => {
		if (hint.mayNotVote) return [t('day.voteNotes.mayNotVote')];
		const players = (seats: string[]) =>
			seats.length ? seats.map((s) => slot(s)).join(', ') : t('common.none');
		return [
			hint.worth !== 1 ? t('day.voteNotes.worth', { count: hint.worth }) : undefined,
			hint.onlyWith
				? t(
						hint.onlyWith.uncounted ? 'day.voteNotes.onlyWithUncounted' : 'day.voteNotes.onlyWith',
						{
							players: players(hint.onlyWith.seats)
						}
					)
				: undefined,
			hint.mustVote ? t('day.voteNotes.mustVote') : undefined,
			hint.needsToken
				? t('day.voteNotes.needsToken', { count: hint.needsToken.tokens })
				: undefined,
			hint.ghostVote === 'free' ? t('day.voteNotes.free') : undefined
		].filter((line): line is string => line !== undefined);
	};
	const seats = $derived(count && count !== 'votes' ? seatsBehind(game, count, characters) : []);
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

{#snippet seatBadge(seatId: string)}<SeatBadge {game} {seatId} />{/snippet}

<Dialog bind:open {title}>
	{#if count === 'votes'}
		<ul class="votes" data-testid="count-votes">
			<li>
				<span class="badge"
					><CountBadge kind="votes" label={blockLine}><Icon name="vote" />{block.needed}</CountBadge
					></span
				><span>{blockLine}</span>
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
			{#if secret}<li data-testid="votes-secret">{t('day.voteNotes.secret')}</li>{/if}
		</ul>
		{#if notes.length}
			<table class="count" data-testid="vote-notes">
				<thead>
					<tr>
						<th scope="col">{t('day.count.player')}</th>
						<th scope="col">{t('day.voteNotes.vote')}</th>
					</tr>
				</thead>
				<tbody>
					{#each notes as hint (hint.seatId)}
						<tr data-seat={hint.seatId}>
							<!-- The badge with its player: the character and the player in one (Trevor,
							     2026-11-02). -->
							<td><SeatBadge {game} seatId={hint.seatId} /></td>
							<td
								>{#each noteLines(hint) as line (line)}<span class="note"
										><Sentence text={line} fill={seatBadge} /></span
									>{/each}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{:else if count}
		<table class="count" data-testid="count-table">
			<thead>
				<tr>
					<th scope="col">{t('day.count.player')}</th>
					{#if status}<th scope="col"
							>{t(count === 'alive' ? 'day.count.status' : 'day.count.ghostVote')}</th
						>{/if}
				</tr>
			</thead>
			<tbody>
				{#each seats as seatId (seatId)}
					<tr data-seat={seatId} data-counts={counts(game, count, seatId, characters) || undefined}>
						<td><SeatBadge {game} {seatId} /></td>
						{#if status}<td>{status(seatId)}</td>{/if}
					</tr>
				{:else}
					<tr><td colspan={status ? 2 : 1}>{t('common.none')}</td></tr>
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
		margin: 0 0 var(--space-3);
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
	.note {
		display: block;
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
