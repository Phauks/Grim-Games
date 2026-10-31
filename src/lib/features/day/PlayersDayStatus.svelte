<script lang="ts">
	import { untrack } from 'svelte';
	import {
		townCounts,
		type dayTimers,
		type PlayersPhase,
		type SetupLook,
		type TownSeat
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Candle, SeatConnection } from '#lib/core/sync/seat-presence.ts';
	import ConnectedDialog from './ConnectedDialog.svelte';
	import CountBadge from './CountBadge.svelte';
	import SetupSky from './SetupSky.svelte';
	import { WatchedTimer } from './watched-timer.svelte.ts';

	/**
	 * A player's status line for where the game is up to (Trevor, 2026-10-26): Setup, the
	 * night, the day with its timer, or Town once the Storyteller calls Back to town, always
	 * with which night or day it is.
	 *
	 * The Storyteller's day timer on a player's phone (Trevor, 2026-10-26: "timer populates on
	 * other screens"), always as a sun (Trevor, 2026-10-29): it rises on the left and crosses the sky
	 * to set on the right as the day's time runs out, filling the sky beneath its path. At the
	 * right the time is all but up; it waits there until the Storyteller ends the day, and less
	 * time from the Storyteller only moves it faster.
	 *
	 * Given the seats, a tap opens the day's counts (Trevor, 2026-10-27): who is alive, the
	 * votes to put a nominee on the block and the ghost votes left, worked out as the
	 * Storyteller's are (`townCounts`), in a sheet so the line itself never grows. While a
	 * living Traveller is in play it also shows the players needed to exile one (Trevor,
	 * 2026-10-28).
	 *
	 * `wide`, on the player screen's own row (Trevor, 2026-10-27: "a sun that takes up 80% of the
	 * width", "flat arc ... more circular"): the sun crosses a shallow slice of a circle across
	 * 80% of the row. That slot is kept in every phase, so the row is as tall at night as by day.
	 *
	 * The sun's look (Trevor, 2026-10-28): it rides the arc from horizon to horizon and pulses
	 * slowly, with no rays. The path it has crossed is a solid line, and the sky beneath it turns
	 * from gold in the morning through amber to red as the time runs out. At night the slot shows
	 * a night sky instead, a crescent moon and stars with no arc, so it is never empty. In Setup
	 * it shows what the Storyteller chose (`SetupSky`): the seats' candles, the town at dusk or
	 * the dusk sky. Given the seats' connections, a tap on the candles opens who is connected
	 * instead of the counts, which mean nothing before the game (Trevor, 2026-10-29).
	 */
	interface Props {
		phase: PlayersPhase;
		/** The day's timer, while the Storyteller shows it to players. */
		timer?: dayTimers.PublicDayTimer;
		/** The town's seats, for the counts a tap opens; without them the line only shows. */
		seats?: readonly TownSeat[];
		/** Alone on its own row: the big sun (above). */
		wide?: boolean;
		/** What shows beside Setup on the wide row, as the Storyteller chose. */
		setupLook?: SetupLook;
		/** The seats' candles, for the candles beside Setup. */
		candles?: readonly Candle[];
		/** Connected phones with no seat, a count beside the candles. */
		unseated?: number;
		/** Each seat's connection, for the list a tap on the candles opens. */
		connections?: readonly SeatConnection[];
		/** The names of the phones with no seat, where they are known. */
		unseatedNames?: readonly string[];
		/** MOCKUP: the effect once every candle is lit. */
		ready?: 'glow' | 'horizon' | 'sparks' | 'wave';
	}

	let {
		phase,
		timer,
		seats,
		wide = false,
		setupLook,
		candles,
		unseated = 0,
		connections,
		unseatedNames,
		ready
	}: Props = $props();
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
	let connectedOpen = $state(false);
	/** The candles beside Setup, with who is connected behind them. */
	const showsConnected = $derived(
		wide && phase.kind === 'setup' && setupLook === 'candles' && !!connections
	);
	const counts = $derived(!showsConnected && seats ? townCounts(seats) : undefined);
	const taps = $derived(showsConnected || !!counts);
	const aliveLabel = $derived(
		counts && t('day.aliveLabel', { count: counts.alive, total: counts.total })
	);
	const votesLabel = $derived(
		counts && t('day.votesBadgeLabel', { count: counts.needed, alive: counts.alive })
	);
	const exileLabel = $derived(
		counts?.exile !== undefined
			? t('day.exileLabel', { count: counts.exile, total: counts.total })
			: undefined
	);
	const ghostLabel = $derived(counts && t('day.ghostVotesLabel', { count: counts.ghostVotes }));

	/** By day the sun; in Town the sun, set. */
	const showTimer = $derived(!!timer && (phase.kind === 'day' || phase.kind === 'town'));
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
	/**
	 * The share of the day's time left. Called Back to town, the sun has set at the end of its
	 * path (Trevor, 2026-10-27), wherever the timer stopped.
	 */
	const left = $derived(phase.kind === 'town' ? 0 : watched.left);
	/**
	 * The sky's colour by the share of the day used: gold to amber over the first 60%, then
	 * amber to red, as `--sky-from`, `--sky-to` and how far between them.
	 */
	const skyStyle = $derived.by(() => {
		const used = 1 - left;
		const [from, to, share] =
			used < 0.6 ? ['morning', 'afternoon', used / 0.6] : ['afternoon', 'late', (used - 0.6) / 0.4];
		return `--sky-from: var(--sky-${from}); --sky-to: var(--sky-${to}); --sky-mix: ${Math.round(share * 100)}%`;
	});
	/** Where the sun is along its path: the share of the day's time used. */
	const angle = $derived(Math.PI * left);
	const sunX = $derived(CX + R * Math.cos(angle));
	const sunY = $derived(HORIZON - R * Math.sin(angle));
	const sky = `M${CX - R} ${HORIZON} A${R} ${R} 0 0 1 ${CX + R} ${HORIZON} Z`;
	const path = `M${CX - R} ${HORIZON} A${R} ${R} 0 0 1 ${CX + R} ${HORIZON}`;

	/**
	 * The wide sun's sky: a slice of a circle over a flat horizon, in the drawing's units. The
	 * arc's ends sit on the horizon and its top leaves room for the sun's glow.
	 */
	const SKY_W = 270;
	const SKY_H = 60;
	/** Room under the horizon for the sun's lower half as it rises and sets. */
	const GROUND = SKY_H - 10;
	/** Room at either end for the sun's glow. */
	const CHORD = SKY_W - 34;
	/** How high the arc rises over the horizon, leaving room above for the sun's glow. */
	const RISE = GROUND - 16;
	const SKY_R = CHORD ** 2 / (8 * RISE) + RISE / 2;
	/** Half the angle the arc spans, seen from the circle's centre. */
	const SPAN = Math.asin(CHORD / 2 / SKY_R);
	const along = $derived(-SPAN + 2 * SPAN * (1 - left));
	const wideX = $derived(SKY_W / 2 + SKY_R * Math.sin(along));
	const wideY = $derived(GROUND - RISE + SKY_R - SKY_R * Math.cos(along));
	const wideArc = `M${(SKY_W - CHORD) / 2} ${GROUND} A${SKY_R} ${SKY_R} 0 0 1 ${(SKY_W + CHORD) / 2} ${GROUND}`;
	/** The night's stars, in the wide sky's units: scattered, a few brighter. */
	const STARS = [
		[18, 30],
		[34, 12],
		[52, 40],
		[70, 22],
		[88, 8],
		[104, 34],
		[122, 16],
		[140, 44],
		[158, 26],
		[176, 8],
		[214, 18],
		[232, 42],
		[250, 26],
		[262, 10],
		[44, 26],
		[134, 4],
		[226, 6]
	] as const;
	/** The moon, up and to the right of the middle. */
	const MOON = { x: 196, y: 20, r: 9 };
</script>

<svelte:element
	this={taps ? 'button' : 'div'}
	type={taps ? 'button' : undefined}
	class="players-status"
	data-testid="players-status"
	data-phase={phase.kind}
	data-wide={wide ? '' : undefined}
	aria-haspopup={taps ? 'dialog' : undefined}
	aria-label={showsConnected ? t('day.connected.open') : undefined}
	onclick={showsConnected
		? () => (connectedOpen = true)
		: counts
			? () => (countsOpen = true)
			: undefined}
	role={taps ? undefined : 'group'}
>
	<span class="words">
		<span class="title">{title}</span>
		<!-- Town says which day it is too. -->
		{#if phase.kind === 'town'}<span class="day"
				>{t('day.titleNumber', { number: phase.number })}</span
			>{/if}
	</span>
	{#if wide}
		<!-- Kept in every phase, so the row never changes height. -->
		<span class="sky-slot">
			{#if showTimer}{@render shownTimer()}{:else if phase.kind === 'night'}{@render nightSky()}{:else if phase.kind === 'setup' && setupLook}<SetupSky
					look={setupLook}
					{candles}
					{unseated}
					{ready}
				/>{/if}
		</span>
	{:else if showTimer}{@render shownTimer()}{/if}
</svelte:element>

{#snippet nightSky()}
	<!-- Only a picture: the words beside it say which night it is. -->
	<svg
		class="wide-sun night-sky"
		data-testid="players-night-sky"
		viewBox="0 0 {SKY_W} {SKY_H}"
		aria-hidden="true"
	>
		<linearGradient id="{id}-night" x1="0" y1="0" x2="0" y2="1">
			<stop class="night-top" offset="0" />
			<stop class="night-low" offset="1" />
		</linearGradient>
		<!-- The sky fades out at either end rather than stopping at an edge. -->
		<linearGradient id="{id}-ends" x1="0" y1="0" x2="1" y2="0">
			<stop class="hidden" offset="0" />
			<stop class="shown" offset="0.12" />
			<stop class="shown" offset="0.88" />
			<stop class="hidden" offset="1" />
		</linearGradient>
		<mask id="{id}-fade"
			><rect x="0" y="0" width={SKY_W} height={GROUND} fill="url(#{id}-ends)" /></mask
		>
		<mask id="{id}-crescent">
			<rect class="shown" x="0" y="0" width={SKY_W} height={SKY_H} />
			<circle
				class="hidden"
				cx={MOON.x + MOON.r * 0.45}
				cy={MOON.y - MOON.r * 0.3}
				r={MOON.r * 0.85}
			/>
		</mask>
		<rect
			x="0"
			y="0"
			width={SKY_W}
			height={GROUND}
			fill="url(#{id}-night)"
			mask="url(#{id}-fade)"
		/>
		{#each STARS as [x, y], i (i)}
			<circle
				class="star"
				data-bright={i % 3 ? undefined : ''}
				cx={x}
				cy={y}
				r={i % 4 ? 0.9 : 1.5}
			/>
		{/each}
		<circle class="moon-glow" cx={MOON.x} cy={MOON.y} r={MOON.r * 1.6} />
		<circle class="moon" cx={MOON.x} cy={MOON.y} r={MOON.r} mask="url(#{id}-crescent)" />
		<line class="horizon" x1="6" y1={GROUND} x2={SKY_W - 6} y2={GROUND} />
	</svg>
{/snippet}

{#snippet shownTimer()}
	{#if timer}
		<span
			class="players-timer"
			data-testid="players-timer"
			data-done={watched.done || phase.kind === 'town' ? '' : undefined}
			style={skyStyle}
		>
			{#if wide}
				<svg
					class="wide-sun"
					viewBox="0 0 {SKY_W} {SKY_H}"
					role="img"
					aria-label={t('day.sunLabel', { percent: Math.round(left * 100) })}
				>
					{@render skyGradient()}
					<clipPath id="{id}-wide"><rect x="0" y="0" width={wideX} height={GROUND} /></clipPath>
					<path d="{wideArc} Z" fill="url(#{id}-sky)" clip-path="url(#{id}-wide)" />
					<path class="path" d={wideArc} />
					<path class="crossed" d={wideArc} clip-path="url(#{id}-wide)" />
					<line class="horizon" x1="6" y1={GROUND} x2={SKY_W - 6} y2={GROUND} />
					<!-- Over the horizon, so it rises and sets on the arc's ends. -->
					<g class="sun">
						<circle class="glow" cx={wideX} cy={wideY} r="12" />
						<circle class="disc" cx={wideX} cy={wideY} r="7.5" />
					</g>
				</svg>
			{:else}
				<svg
					viewBox="0 0 48 28"
					role="img"
					aria-label={t('day.sunLabel', { percent: Math.round(left * 100) })}
				>
					<!-- The sky beneath the sun's path so far, filled from the left up to the sun. -->
					{@render skyGradient()}
					<clipPath id="{id}-passed"><rect x="0" y="0" width={sunX} height={HORIZON} /></clipPath>
					<path d={sky} fill="url(#{id}-sky)" clip-path="url(#{id}-passed)" />
					<path class="path" d={path} />
					<path class="crossed" d={path} clip-path="url(#{id}-passed)" />
					<line class="horizon" x1="3" y1={HORIZON} x2="45" y2={HORIZON} />
					<g class="sun">
						<circle class="glow" cx={sunX} cy={sunY} r="5.5" />
						<circle class="disc" cx={sunX} cy={sunY} r="3.5" />
					</g>
				</svg>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet skyGradient()}
	<!-- The sky under the sun's crossed path, strongest at the top. -->
	<linearGradient id="{id}-sky" x1="0" y1="0" x2="0" y2="1">
		<stop class="sky-top" offset="0" />
		<stop class="sky-low" offset="1" />
	</linearGradient>
{/snippet}

{#if showsConnected && connections}
	<ConnectedDialog bind:open={connectedOpen} {connections} {unseated} {unseatedNames} />
{/if}

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
			{#if counts.exile !== undefined}
				<!-- Only while a living Traveller is in play: nobody else can be exiled. -->
				<li>
					<CountBadge kind="votes" label={exileLabel!} testid="players-exile-needed"
						><Icon name="exile" />{counts.exile}</CountBadge
					><span>{exileLabel}</span>
				</li>
			{/if}
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
	/* The day on the left, the sky across 80% of the row (Trevor, 2026-10-27). */
	.players-status[data-wide] {
		justify-content: space-between;
		padding-block: var(--space-1);
	}
	.players-status[data-wide] .words {
		flex: 1;
		min-width: 0;
	}
	.sky-slot {
		display: flex;
		flex: 0 1 80%;
		align-items: center;
		justify-content: center;
		min-width: 0;
		aspect-ratio: 270 / 60;
		max-height: 7rem;
	}
	.sky-slot .players-timer {
		width: 100%;
		height: 100%;
		justify-content: center;
	}
	/* The sun's glow may spill into the row's padding as it pulses on the horizon. */
	svg.wide-sun {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.wide-sun .path {
		stroke-width: 1.2;
		stroke-dasharray: 1.5 4;
	}
	.wide-sun .crossed {
		stroke-width: 1.8;
		stroke-dasharray: none;
	}
	.wide-sun .horizon {
		stroke-width: 2;
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
	/* The sky's colour for the time of day (skyStyle), between two of the theme's sky colours. */
	.players-timer {
		--sky: color-mix(in srgb, var(--sky-from), var(--sky-to) var(--sky-mix));
		/* colour-ok: the share moves with the day's time */
	}
	.sun {
		fill: var(--sky-sun);
	}
	.sun .glow {
		fill: var(--sky);
		opacity: 0.3;
	}
	/* The sun breathes slowly (Trevor, 2026-10-28): its glow swells and fades, the disc with it. */
	.sun .glow,
	.sun .disc {
		transform-box: fill-box;
		transform-origin: center;
	}
	@media (prefers-reduced-motion: no-preference) {
		.sun .glow {
			animation: sun-glow 4s ease-in-out infinite;
		}
		.sun .disc {
			animation: sun-swell 4s ease-in-out infinite;
		}
	}
	@keyframes sun-glow {
		0%,
		100% {
			transform: scale(0.9);
			opacity: 0.35;
		}
		50% {
			transform: scale(1.25);
			opacity: 0.12;
		}
	}
	@keyframes sun-swell {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.04);
		}
	}
	.sky-top {
		stop-color: var(--sky);
		stop-opacity: 0.6;
	}
	.sky-low {
		stop-color: var(--sky);
		stop-opacity: 0.1;
	}
	.crossed {
		fill: none;
		stroke: var(--sky);
		stroke-width: 1.2;
	}
	.night-top {
		stop-color: var(--sky-night);
		stop-opacity: 0;
	}
	.night-low {
		stop-color: var(--sky-night);
		stop-opacity: 0.75;
	}
	/* Mask paint: white shows, black hides. */
	.shown {
		stop-color: white; /* colour-ok: a mask's paint, never seen */
		fill: white; /* colour-ok: a mask's paint, never seen */
	}
	.hidden {
		stop-color: black; /* colour-ok: a mask's paint, never seen */
		fill: black; /* colour-ok: a mask's paint, never seen */
	}
	.star {
		fill: var(--sky-moon);
		opacity: 0.55;
	}
	.star[data-bright] {
		opacity: 0.9;
	}
	.moon,
	.moon-glow {
		fill: var(--sky-moon);
	}
	.moon-glow {
		opacity: 0.08;
	}
	.path {
		fill: none;
		stroke: var(--on-surface-muted);
		stroke-width: 0.75;
		stroke-dasharray: 1.5 1.5;
	}
	.horizon {
		stroke: var(--on-surface-muted);
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.players-status:has([data-done]) {
		border-color: var(--evil);
	}
</style>
