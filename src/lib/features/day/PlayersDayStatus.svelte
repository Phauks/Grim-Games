<script lang="ts">
	import { untrack } from 'svelte';
	import {
		townCounts,
		type dayTimers,
		type PlayersPhase,
		type TownSeat
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CountBadge from './CountBadge.svelte';
	import { WatchedTimer } from './watched-timer.svelte.ts';

	/**
	 * A player's status line for where the game is up to (Trevor, 2026-10-26): Setup, the
	 * night, the day with its timer, or Town once the Storyteller calls Back to town, always
	 * with which night or day it is.
	 *
	 * The Storyteller's day timer on a player's phone (Trevor, 2026-10-26: "timer populates on
	 * other screens ... sun or timer for players", the Storyteller decides). The clock as the
	 * board shows it, or a sun (Trevor, 2026-10-26): it rises on the left and crosses the sky
	 * to set on the right as the day's time runs out, filling the sky beneath its path. At the
	 * right the time is all but up; it waits there until the Storyteller ends the day, and less
	 * time from the Storyteller only moves it faster.
	 *
	 * Given the seats, a tap opens the day's counts (Trevor, 2026-10-27): who is alive, the
	 * votes to put a nominee on the block and the ghost votes left, worked out as the
	 * Storyteller's are (`townCounts`), in a sheet so the line itself never grows.
	 */
	interface Props {
		phase: PlayersPhase;
		/** The day's timer, while the Storyteller shows it to players. */
		timer?: dayTimers.PublicDayTimer;
		/** The town's seats, for the counts a tap opens; without them the line only shows. */
		seats?: readonly TownSeat[];
	}

	let { phase, timer, seats }: Props = $props();
	const title = $derived(
		phase.kind === 'setup'
			? t('day.setup')
			: phase.kind === 'night'
				? t('day.nightNumber', { number: phase.number })
				: phase.kind === 'town'
					? t('day.town')
					: t('day.titleNumber', { number: phase.number })
	);

	let countsOpen = $state(false);
	const counts = $derived(seats && townCounts(seats));
	const aliveLabel = $derived(
		counts && t('day.aliveLabel', { count: counts.alive, total: counts.total })
	);
	const votesLabel = $derived(
		counts && t('day.votesBadgeLabel', { count: counts.needed, alive: counts.alive })
	);
	const ghostLabel = $derived(counts && t('day.ghostVotesLabel', { count: counts.ghostVotes }));

	const watched = new WatchedTimer();
	// Each copy from the room replaces the last; untracked, as set reads what it writes.
	$effect(() => {
		const next = timer;
		untrack(() => watched.set(next));
	});
	$effect(() => () => watched.stop());
	const id = $props.id();
	/** The sun's path: half a circle over the horizon, left to right, in the drawing's units. */
	const CX = 24;
	const HORIZON = 24;
	const R = 17;
	/** Where the sun is along its path: the share of the day's time used. */
	const angle = $derived(Math.PI * watched.left);
	const sunX = $derived(CX + R * Math.cos(angle));
	const sunY = $derived(HORIZON - R * Math.sin(angle));
	const sky = `M${CX - R} ${HORIZON} A${R} ${R} 0 0 1 ${CX + R} ${HORIZON} Z`;
	const path = `M${CX - R} ${HORIZON} A${R} ${R} 0 0 1 ${CX + R} ${HORIZON}`;
</script>

<svelte:element
	this={counts ? 'button' : 'div'}
	type={counts ? 'button' : undefined}
	class="players-status"
	data-testid="players-status"
	data-phase={phase.kind}
	aria-haspopup={counts ? 'dialog' : undefined}
	onclick={counts ? () => (countsOpen = true) : undefined}
	role={counts ? undefined : 'group'}
>
	<span class="words">
		<span class="title">{title}</span>
		<!-- Town says which day it is too. -->
		{#if phase.kind === 'town'}<span class="day"
				>{t('day.titleNumber', { number: phase.number })}</span
			>{/if}
	</span>
	{#if timer && phase.kind === 'day'}
		<span
			class="players-timer"
			data-testid="players-timer"
			data-look={timer.look}
			data-done={watched.done ? '' : undefined}
		>
			{#if timer.look === 'sun'}
				<svg
					viewBox="0 0 48 28"
					role="img"
					aria-label={t('day.sunLabel', { percent: Math.round(watched.left * 100) })}
				>
					<!-- The sky beneath the sun's path so far, filled from the left up to the sun. -->
					<clipPath id="{id}-passed"><rect x="0" y="0" width={sunX} height={HORIZON} /></clipPath>
					<path class="sky" d={sky} clip-path="url(#{id}-passed)" />
					<path class="path" d={path} />
					<g class="sun">
						<circle class="glow" cx={sunX} cy={sunY} r="5.5" />
						<circle cx={sunX} cy={sunY} r="3.5" />
					</g>
					<rect class="ground" x="0" y={HORIZON} width="48" height="10" />
					<line class="horizon" x1="3" y1={HORIZON} x2="45" y2={HORIZON} />
				</svg>
			{:else}
				<span class="clock" role="timer" aria-label={t('day.timer')}>{watched.clock}</span>
			{/if}
		</span>
	{/if}
</svelte:element>

{#if counts}
	<!-- Read only: the Storyteller's badges, each with its words beside it. -->
	<Dialog bind:open={countsOpen} {title}>
		<ul class="counts" data-testid="players-counts">
			<li>
				<CountBadge kind="alive" label={aliveLabel!} testid="players-alive"
					><Icon name="alive" />{t('day.aliveBadge', {
						count: counts.alive,
						total: counts.total
					})}</CountBadge
				><span>{aliveLabel}</span>
			</li>
			<li>
				<CountBadge kind="votes" label={votesLabel!} testid="players-votes-needed"
					><Icon name="vote" />{counts.needed}</CountBadge
				><span>{votesLabel}</span>
			</li>
			<li>
				<CountBadge kind="ghost" label={ghostLabel!} testid="players-ghost-votes"
					><Icon name="ghostVote" weight="fill" />{counts.ghostVotes}</CountBadge
				><span>{ghostLabel}</span>
			</li>
		</ul>
	</Dialog>
{/if}

<style>
	/* Beside the "You" row, in its look: the same edge, fill and corners. Wide enough for the
	   day and its sun from the start, so the row doesn't shift as the phase changes. */
	.players-status {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		box-sizing: border-box;
		min-width: calc(var(--tap-target) * 3.25);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
	}
	button.players-status {
		cursor: pointer;
	}
	/* Rows with lines between them, each badge in a column of its own width. */
	.counts {
		display: grid;
		grid-template-columns: calc(var(--tap-target) * 2) 1fr;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.counts li {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
	}
	.counts li + li {
		border-top: 1px solid var(--border);
	}
	.words {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.2;
	}
	.title {
		font-weight: 700;
		white-space: nowrap;
	}
	.day {
		color: var(--on-surface-muted);
		font-size: 0.85em;
		white-space: nowrap;
	}
	.players-timer {
		display: inline-flex;
		align-items: center;
	}
	svg {
		width: 4rem;
		height: 2.35rem;
		overflow: hidden;
	}
	/* The heading's gold, so it reads as a sun on every theme. */
	.sun {
		fill: var(--heading);
	}
	.glow {
		opacity: 0.3;
	}
	.sky {
		fill: var(--heading);
		opacity: 0.45;
	}
	.path {
		fill: none;
		stroke: var(--on-surface-muted);
		stroke-width: 0.75;
		stroke-dasharray: 1.5 1.5;
	}
	/* Below the horizon the sun is hidden by the ground, the row's own fill. */
	.ground {
		fill: var(--surface-raised);
	}
	.horizon {
		stroke: var(--on-surface-muted);
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.clock {
		min-width: 4.5ch;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		text-align: center;
	}
	.players-status:has([data-done]) {
		border-color: var(--evil);
	}
	.players-timer[data-done] .clock {
		color: var(--evil);
	}
</style>
