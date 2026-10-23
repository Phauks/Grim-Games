<script lang="ts">
	import {
		blockThreshold,
		ghostVotesLeft,
		livingByTeam,
		type DayCount
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CountDialog from './CountDialog.svelte';
	import type { DayPort } from './day-port.ts';

	/** The day's counts, each opening how it was worked out (moved from DayPanel). */
	interface Props {
		game: DayPort;
	}

	let { game }: Props = $props();
	const g = $derived(game.game);

	/** Votes for the first nominee, from who is alive now (core `blockThreshold`). */
	const block = $derived(blockThreshold(g));
	/** Living players on each team (Trevor, 2026-10-17), beside the votes badge. */
	const teams = $derived(livingByTeam(g));
	const ghostVotes = $derived(ghostVotesLeft(g));
	const aliveLabel = $derived(t('day.aliveLabel', { count: teams.alive, total: g.seating.length }));
	const goodLabel = $derived(t('day.goodLabel', { count: teams.good }));
	const evilLabel = $derived(t('day.evilLabel', { count: teams.evil }));
	const ghostLabel = $derived(t('day.ghostVotesLabel', { count: ghostVotes }));
	const votesLabel = $derived(
		t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })
	);
	// ── How a count was worked out, from tapping it ──
	let countOpen = $state(false);
	let countShown = $state<DayCount | 'votes'>();
	let countTitle = $state('');
	function openCount(count: DayCount | 'votes', title: string) {
		countShown = count;
		countTitle = title;
		countOpen = true;
	}
</script>

<!--
	One line on every phone (Trevor, 2026-10-17): living of all players, each team's
	living, ghost votes left and votes to put a nominee on the block. Numbers with icons
	or team colours; the words are in each one's accessible name.
-->
<div class="counts">
	<!-- Each one opens how it was worked out (Trevor, 2026-10-19). -->
	<button
		type="button"
		class="badge alive"
		data-testid="alive-count"
		aria-label={aliveLabel}
		title={aliveLabel}
		onclick={() => openCount('alive', aliveLabel)}
		><Icon name="alive" />{t('day.aliveBadge', {
			count: teams.alive,
			total: g.seating.length
		})}</button
	>
	<button
		type="button"
		class="badge good"
		data-testid="alive-good"
		aria-label={goodLabel}
		title={goodLabel}
		onclick={() => openCount('good', goodLabel)}>{teams.good}</button
	>
	<button
		type="button"
		class="badge evil"
		data-testid="alive-evil"
		aria-label={evilLabel}
		title={evilLabel}
		onclick={() => openCount('evil', evilLabel)}>{teams.evil}</button
	>
	<button
		type="button"
		class="badge ghost"
		data-testid="ghost-votes"
		aria-label={ghostLabel}
		title={ghostLabel}
		onclick={() => openCount('ghostVotes', ghostLabel)}
		><Icon name="ghostVote" weight="fill" />{ghostVotes}</button
	>
	<!--
		Votes the first nominee needs to go on the block, from who is alive now, so a death
		mid-day updates it. Nominations and votes are not tracked, so "more than the player
		on the block" is left to the Storyteller.
	-->
	<button
		type="button"
		class="badge votes"
		data-testid="votes-needed"
		aria-label={votesLabel}
		title={votesLabel}
		onclick={() => openCount('votes', votesLabel)}><Icon name="vote" />{block.needed}</button
	>
</div>

<CountDialog bind:open={countOpen} game={g} count={countShown} title={countTitle} />

<style>
	/*
	 * One line however narrow (Trevor, 2026-10-17): five equal cells sharing the width, the
	 * numbers shrinking only on the narrowest phones with the largest text.
	 */
	.counts {
		container-type: inline-size;
		display: flex;
		flex-basis: 100%;
		gap: var(--space-1);
	}
	.badge {
		display: inline-flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		font-size: clamp(0.75rem, 5cqi, 1rem);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	/* Every count is filled, the number on top (Trevor, 2026-10-19): the team counts in their
	   team's colour. --on-good reads on both teams (badge-colours.test.ts). */
	.badge {
		border-color: var(--surface-selected);
		background: var(--surface-selected);
		color: var(--on-surface);
		font-family: inherit;
		cursor: pointer;
	}
	.badge.good {
		border-color: var(--good);
		background: var(--good);
		color: var(--on-good);
	}
	.badge.evil {
		border-color: var(--evil);
		background: var(--evil);
		color: var(--on-good);
	}
	/* Each count in its own colour (Trevor, 2026-10-20: L21). The living are both teams, so
	   half blue, half red; --on-good reads on both halves. */
	.badge.alive {
		border-color: transparent;
		background: var(--evil) linear-gradient(to right, var(--good) 50%, var(--evil) 50%) border-box;
		color: var(--on-good);
	}
	/* Ghost votes left in an unused ghost vote's colours (DeadBadge.svelte), inverted: a dark
	   ghost on white (Trevor, 2026-10-22). */
	.badge.ghost {
		border-color: var(--ghost-vote-rim);
		background: var(--ghost-vote);
		color: var(--ghost-vote-badge);
	}
	/* Votes needed in gold; --heading on --surface is a theme contrast pair. */
	.badge.votes {
		border-color: var(--heading);
		background: var(--heading);
		color: var(--surface);
		font-family: var(--font-control);
	}
</style>
