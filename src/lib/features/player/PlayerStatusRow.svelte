<script lang="ts">
	import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import * as dayTimers from '#lib/core/rules/day/day-timer.ts';
	import {
		parsePlayersPhase,
		parseSetupLook,
		type PlayersPhase
	} from '#lib/core/rules/game-phase.ts';
	import { seatCandles, seatConnections, type SeatPresence } from '#lib/core/sync/seat-presence.ts';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { clock, timeLeft } from '#lib/features/room/time-left.svelte.ts';
	import { gameOverText } from '#lib/features/room/game-over-text.ts';
	import { playerStatus, type PlayerStatusFacts } from './player-status.ts';

	/**
	 * The status box over the player screen's tabs (Trevor, 2026-10-26), on phones in a room and
	 * in the Storyteller's Player view, which feeds it the state the room would get
	 * (`tableState`), so whatever is added here shows on both (Trevor, 2026-10-27: "Design it
	 * so that these additions move in automatically").
	 *
	 * One box, one thing at a time (Trevor, 2026-11-16: "unify into one"): the hosts pass what
	 * they know and `playerStatus` picks what shows. Where the game is up to is always drawn,
	 * and anything else covers it in the same box, so the box keeps one size and nothing below
	 * moves; before the game reaches the room, an unseen stand-in holds its size.
	 */
	interface Props {
		/** The game's public state as players' phones get it. */
		table?: PublicGameState;
		/** A phone's link to its room; the Storyteller's view has none. */
		link?: PlayerStatusFacts['link'];
		/** The Storyteller is choosing the next script. */
		choosing?: boolean;
		/** The game is over, with who won where the Storyteller said. */
		over?: { winner?: 'good' | 'evil' };
		/**
		 * Opens the Game over sheet, where a phone rates the game (Trevor, 2026-11-15: rating
		 * lives in the status box, no separate button); without it Game over only shows.
		 */
		rate?: () => void;
		/** Opens Your character (Trevor, 2026-11-03), while players may see theirs. */
		character?: () => void;
		/**
		 * When players stop seeing theirs (epoch ms): Your character counts down to it
		 * (Trevor, 2026-11-12). None while it has no end, such as a seat just given.
		 */
		characterUntil?: number;
		/**
		 * Turns to where seats are picked, for a phone with a seat to pick, away from the Grim
		 * tab (Trevor, 2026-11-16).
		 */
		selectSeat?: () => void;
		/** Who is connected, for the candles beside Setup; without it a named seat burns. */
		presence?: SeatPresence;
		/** This phone's own seat, whose candle burns red. */
		mySeat?: SeatId;
		/** This phone's seat number, for tests to read; the screen doesn't say it. */
		seatNumber?: number;
		/** The names of connected phones with no seat, where the room tells them (the Storyteller). */
		unseatedNames?: readonly string[];
	}

	let {
		table,
		link,
		choosing = false,
		over,
		rate,
		character,
		characterUntil,
		selectSeat,
		presence,
		mySeat,
		seatNumber,
		unseatedNames
	}: Props = $props();

	const status = $derived(
		playerStatus({
			link,
			choosing,
			over,
			character: !!character,
			selectSeat: !!selectSeat,
			now: table?.now
		})
	);
	const characterLeft = timeLeft(() => (status.kind === 'character' ? characterUntil : undefined));

	/**
	 * Where the game is up to, drawn under any cover so the box keeps the game's size; before
	 * the game reaches the room, a stand-in holds that size unseen.
	 */
	const STAND_IN: PlayersPhase = { kind: 'setup' };
	const phase = $derived(parsePlayersPhase(table?.now));
	const shown = $derived(status.kind === 'phase');
	const timer = $derived(phase ? dayTimers.parsePublicTimer(table?.timer) : undefined);
	const setupLook = $derived(phase ? parseSetupLook(table?.setupLook) : undefined);
	const candles = $derived(
		setupLook === 'candles' ? seatCandles(table?.seats ?? [], presence, mySeat) : undefined
	);
	const connections = $derived(
		setupLook === 'candles' ? seatConnections(table?.seats ?? [], presence) : undefined
	);
	/** What the box says in words, where it says some. */
	const said = $derived(
		status.kind === 'joining'
			? t('room.joining')
			: status.kind === 'offline'
				? t('room.playerOffline')
				: status.kind === 'choosing'
					? t('room.choosing')
					: status.kind === 'over'
						? gameOverText(status.winner)
						: undefined
	);
</script>

<div
	class="status-row"
	data-testid="player-status-row"
	data-status={status.kind}
	data-seat={seatNumber}
>
	<div class="game" data-covered={shown ? undefined : ''}>
		<PlayersDayStatus
			phase={phase ?? STAND_IN}
			{timer}
			seats={phase ? (table?.seats ?? []) : undefined}
			wide
			{setupLook}
			{candles}
			unseated={presence?.unseated ?? 0}
			{connections}
			{unseatedNames}
		/>
		{#if status.kind === 'over' && rate}<button
				type="button"
				class="cover said"
				aria-haspopup="dialog"
				data-team={status.winner}
				onclick={rate}
				><span class="summary" role="status" data-testid="join-status">{said}</span><span
					class="action">{t('room.feedback.rate')}</span
				></button
			>{:else if said !== undefined}<p
				class="cover said"
				data-team={status.kind === 'over' ? status.winner : undefined}
			>
				<span class="summary" role="status" data-testid="join-status">{said}</span>
			</p>{:else if status.kind === 'character'}<button
				type="button"
				class="cover named"
				aria-haspopup="dialog"
				data-testid="your-character"
				onclick={character}
				><Icon name="yourCharacter" />{characterLeft.ms === undefined
					? t('room.role.open')
					: t('room.role.openTime', { time: clock(characterLeft.ms) })}</button
			>{:else if status.kind === 'selectSeat'}<button
				type="button"
				class="cover named"
				data-testid="select-seat"
				onclick={selectSeat}><Icon name="arrange" />{t('room.selectSeat')}</button
			>{/if}
	</div>
</div>

<style>
	/* As far under the title's byline as the screen's side margin (Trevor, 2026-10-28:
	   "Increase space after author name to status bar"). On /play that is the page gutter,
	   less the --space-4 the Page already leaves under its header; the Storyteller's dialog
	   gives its own (--player-status-gap). */
	.status-row {
		display: flex;
		margin-top: var(--player-status-gap, calc(var(--page-gutter) - var(--space-4)));
		margin-bottom: var(--space-2);
	}
	/* The box takes the whole row (Trevor, 2026-10-27: "the game status bar should then take up
	   the entire horizontal of that line area"). */
	.game {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.game > :global([data-testid='players-status']) {
		flex: 1;
	}
	.game[data-covered] > :global([data-testid='players-status']) {
		visibility: hidden;
	}
	/* Anything else in the game status's place, drawn as that box is (PlayersDayStatus). */
	.cover {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
	}
	button.cover {
		cursor: pointer;
		touch-action: manipulation;
	}
	/* Your character and Select seat: an icon and a name, in the middle. */
	.named {
		justify-content: center;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
	}
	.named :global(svg) {
		font-size: 1.5em;
	}
	/* What the room says, and what tapping does under it. */
	.said {
		flex-direction: column;
		align-items: stretch;
		justify-content: center;
		gap: 0;
		padding-inline: var(--space-3);
	}
	/* Who won, in their team's colour (Trevor, 2026-11-01). */
	.said[data-team='good'] {
		border-color: var(--good);
		background: var(--good);
		color: var(--on-good);
	}
	.said[data-team='evil'] {
		border-color: var(--evil);
		background: var(--evil);
		color: var(--on-evil);
	}
	/* The game's end in the theme's display face (Trevor, 2026-11-15: "game over font should
	   be better"); what tapping does under it, in the body face, smaller. */
	.said[data-team] .summary,
	button.said .summary {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.2rem;
		letter-spacing: 0.04em;
	}
	.action {
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-style: italic;
		opacity: 0.85;
	}
</style>
