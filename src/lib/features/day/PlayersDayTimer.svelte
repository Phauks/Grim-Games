<script lang="ts">
	import { untrack } from 'svelte';
	import type { dayTimers } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { WatchedTimer } from './watched-timer.svelte.ts';

	/**
	 * The Storyteller's day timer on a player's phone (Trevor, 2026-10-26: "timer populates on
	 * other screens ... sun or timer for players", the Storyteller decides). The clock as the
	 * board shows it, or a sun (Trevor, 2026-10-26): it rises on the left and crosses the sky
	 * to set on the right as the day's time runs out, filling the sky beneath its path. At the
	 * right the time is all but up; it waits there until the Storyteller ends the day, and less
	 * time from the Storyteller only moves it faster. It only shows: nothing can be pressed.
	 */
	interface Props {
		timer: dayTimers.PublicDayTimer;
	}

	let { timer }: Props = $props();

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

<div
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
</div>

<style>
	/* Beside the "You" row, in its look: the same edge, fill and corners. */
	.players-timer {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: calc(var(--tap-target) * 1.5);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
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
	.players-timer[data-done] {
		border-color: var(--evil);
	}
	.players-timer[data-done] .clock {
		color: var(--evil);
	}
</style>
