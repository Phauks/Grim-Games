<script lang="ts">
	import { untrack } from 'svelte';
	import type { dayTimers } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { WatchedTimer } from './watched-timer.svelte.ts';

	/**
	 * The Storyteller's day timer on a player's phone (Trevor, 2026-10-26: "timer populates on
	 * other screens ... sun or timer for players", the Storyteller decides). The clock as the
	 * board shows it, or a sun that sinks to the horizon as the day's time runs out. It only
	 * shows: nothing on it can be pressed.
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
	/** The sun's height over the horizon, in the drawing's units: 13 at the start, 0 at the end. */
	const rise = $derived(13 * watched.left);
</script>

<div
	class="players-timer"
	data-testid="players-timer"
	data-look={timer.look}
	data-done={watched.done ? '' : undefined}
>
	{#if timer.look === 'sun'}
		<svg
			viewBox="0 0 40 28"
			role="img"
			aria-label={t('day.sunLabel', { percent: Math.round(watched.left * 100) })}
		>
			<g class="sun" transform="translate(0 {-rise})">
				<circle class="glow" cx="20" cy="22" r="8" />
				<circle cx="20" cy="22" r="5.5" />
			</g>
			<rect class="ground" x="0" y="22" width="40" height="6" />
			<line class="horizon" x1="2" y1="22" x2="38" y2="22" />
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
		width: 3rem;
		height: 2.1rem;
		overflow: hidden;
	}
	/* The heading's gold, so it reads as a sun on every theme. */
	.sun {
		fill: var(--heading);
	}
	.glow {
		opacity: 0.3;
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
