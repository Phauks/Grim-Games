<script lang="ts">
	import {
		blockThreshold,
		exileThreshold,
		ghostVotesLeft,
		livingByTeam,
		type DayCount
	} from '#lib/core/rules/index.ts';
	import { inPlay } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CountBadge from './CountBadge.svelte';
	import CountDialog from './CountDialog.svelte';
	import type { DayPort } from './day-port.ts';

	/** The day's counts, each opening how it was worked out (moved from DayPanel). */
	interface Props {
		game: DayPort;
	}

	let { game }: Props = $props();
	/** Seats not in play yet count for nothing (Trevor, 2026-10-31). */
	const g = $derived(inPlay(game.game));

	/** Votes for the first nominee, from who is alive now (core `blockThreshold`). */
	const block = $derived(blockThreshold(g, game.characters));
	/** Living players on each team (Trevor, 2026-10-17), beside the votes badge. */
	const teams = $derived(livingByTeam(g));
	const ghostVotes = $derived(ghostVotesLeft(g, game.characters));
	const aliveLabel = $derived(t('day.aliveLabel', { count: teams.alive, total: g.seating.length }));
	const goodLabel = $derived(t('day.goodLabel', { count: teams.good }));
	const evilLabel = $derived(t('day.evilLabel', { count: teams.evil }));
	const ghostLabel = $derived(t('day.ghostVotesLabel', { count: ghostVotes }));
	/** Players to exile a Traveller, while a living one is in play (Trevor, 2026-10-28). */
	const exile = $derived(exileThreshold(g, game.characters));
	const votesLabel = $derived(
		[
			block.mostVotes
				? t('day.count.mostVotes')
				: t('day.votesBadgeLabel', { count: block.needed, alive: block.alive }),
			...(exile === undefined
				? []
				: [t('day.exileLabel', { count: exile, total: g.seating.length })])
		].join('; ')
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
	<CountBadge
		kind="alive"
		label={aliveLabel}
		testid="alive-count"
		onclick={() => openCount('alive', aliveLabel)}
		><Icon name="alive" />{t('day.aliveBadge', {
			count: teams.alive,
			total: g.seating.length
		})}</CountBadge
	>
	<CountBadge
		kind="good"
		label={goodLabel}
		testid="alive-good"
		onclick={() => openCount('good', goodLabel)}>{teams.good}</CountBadge
	>
	<CountBadge
		kind="evil"
		label={evilLabel}
		testid="alive-evil"
		onclick={() => openCount('evil', evilLabel)}>{teams.evil}</CountBadge
	>
	<CountBadge
		kind="ghost"
		label={ghostLabel}
		testid="ghost-votes"
		onclick={() => openCount('ghostVotes', ghostLabel)}
		><Icon name="ghostVote" weight="fill" />{ghostVotes}</CountBadge
	>
	<!--
		Votes the first nominee needs to go on the block, from who is alive now, so a death
		mid-day updates it. Nominations and votes are not tracked, so "more than the player
		on the block" is left to the Storyteller.
	-->
	<CountBadge
		kind="votes"
		label={votesLabel}
		testid="votes-needed"
		onclick={() => openCount('votes', t('day.votesTitle'))}
		>{#if exile === undefined}<Icon name="vote" />{block.needed}{:else}
			<!-- With a living Traveller the same gold badge holds the exile count too, so the row
			     keeps its five cells (Trevor, 2026-10-28, option A). -->
			<span class="pair" data-testid="exile-needed"
				><Icon name="vote" />{block.needed}<span class="split" aria-hidden="true"></span><Icon
					name="exile"
				/>{exile}</span
			>{/if}</CountBadge
	>
</div>

<CountDialog
	bind:open={countOpen}
	game={g}
	characters={game.characters}
	count={countShown}
	title={countTitle}
/>

<style>
	/* Two numbers in one cell: smaller icons, so it fits a phone's fifth of the row. */
	.pair {
		--icon-size: 1em;
		display: inline-flex;
		align-items: center;
		gap: 0.1em;
	}
	/* A gap between the two counts; the icons tell them apart (Trevor, 2026-10-31: no |). */
	.split {
		inline-size: 0.35em;
	}
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
</style>
