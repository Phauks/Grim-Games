<script lang="ts">
	import { ACCOLADES, summarizeFeedback, type AccoladeId } from '#lib/core/feedback/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { seatNumber, type Game } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { gameFeedback } from './game-feedback.svelte.ts';

	/**
	 * Players' feedback on a finished game, for the Storyteller (Trevor, 2026-10-25): the
	 * totals, then each player's rating, accolades and comment, named only when they chose
	 * to be. Read from this device, where the room's feedback is saved with the game.
	 */
	interface Props {
		open: boolean;
		game: Game;
	}

	let { open = $bindable(), game }: Props = $props();

	const entries = $derived(open ? gameFeedback.read(game.gameId) : []);
	const summary = $derived(summarizeFeedback(entries.map((e) => e.feedback)));
	const given = $derived(summary.accolades.filter((a) => a.count > 0));
	const emoji = (id: AccoladeId) => ACCOLADES.find((a) => a.id === id)?.emoji ?? '';
	const accoladeText = (id: AccoladeId) => `${emoji(id)} ${t(`room.feedback.accolade.${id}`)}`;
</script>

<BottomSheet bind:open title={t('room.feedback.view')}>
	<div class="feedback" data-testid="game-feedback">
		<section aria-labelledby="feedback-rating">
			<h3 id="feedback-rating">{t('room.feedback.rating')}</h3>
			<p data-testid="feedback-average">
				{summary.rating === undefined
					? t('common.none')
					: t('room.feedback.average', { rating: summary.rating, count: summary.ratings })}
			</p>
		</section>
		<section aria-labelledby="feedback-accolades">
			<h3 id="feedback-accolades">{t('room.feedback.accolades')}</h3>
			{#if given.length === 0}
				<p>{t('common.none')}</p>
			{:else}
				<ul data-testid="feedback-accolade-counts">
					{#each given as { id, count } (id)}
						<li>{t('room.feedback.accoladeCount', { accolade: accoladeText(id), count })}</li>
					{/each}
				</ul>
			{/if}
		</section>
		<section aria-labelledby="feedback-entries">
			<h3 id="feedback-entries">{t('room.feedback.entries')}</h3>
			{#if entries.length === 0}
				<p>{t('common.none')}</p>
			{:else}
				<ul class="entries">
					{#each entries as entry (entry.id)}
						{@const seat = entry.seatId ? seatNumber(game, entry.seatId) : undefined}
						<li data-testid="feedback-entry">
							<p class="who">
								{#if entry.feedback.anonymous || (!entry.name && seat === undefined)}
									{t('room.feedback.anonymous')}
								{:else}
									{#if entry.name}<PlayerBadge name={entry.name as PlayerName} />{/if}
									{#if seat !== undefined}<span>{t('common.seat', { number: seat })}</span>{/if}
								{/if}
							</p>
							{#if entry.feedback.rating !== undefined}
								<p>{t('room.feedback.ratingValue', { rating: entry.feedback.rating })}</p>
							{/if}
							{#if entry.feedback.accolades.length > 0}
								<p>{entry.feedback.accolades.map(accoladeText).join(' · ')}</p>
							{/if}
							{#if entry.feedback.comment}
								<p class="comment">{entry.feedback.comment}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</BottomSheet>

<style>
	.feedback {
		display: grid;
		gap: var(--space-4);
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	p {
		margin: 0;
	}
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.entries {
		gap: var(--space-3);
	}
	.entries li {
		display: grid;
		gap: var(--space-1);
		padding-block-start: var(--space-2);
		border-top: 0.0625rem solid var(--border);
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
	}
	.comment {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
