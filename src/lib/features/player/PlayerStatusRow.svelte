<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import * as dayTimers from '#lib/core/rules/day/day-timer.ts';
	import { parsePlayersPhase, parseSetupLook } from '#lib/core/rules/game-phase.ts';
	import { seatCandles, seatConnections, type SeatPresence } from '#lib/core/sync/seat-presence.ts';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { clock, timeLeft } from '#lib/features/room/time-left.svelte.ts';

	/**
	 * The row over the player screen's tabs: everything the table's public state shows there,
	 * such as where the game is up to and the day timer (Trevor, 2026-10-26). A phone feeds it
	 * its room's copy; the board's Script and the grim cover's Player view feed it the state
	 * the room would get (`tableState`), so whatever is added here shows on both
	 * (Trevor, 2026-10-27: "Design it so that these additions move in automatically"). What
	 * only a phone in a room has (its character, Rate this game) comes in props or `after`.
	 */
	interface Props {
		/** The game's public state as players' phones get it. */
		table?: PublicGameState;
		/** The game is over: where it was up to no longer shows. */
		ended?: boolean;
		/** Who is connected, for the candles beside Setup; without it a named seat burns. */
		presence?: SeatPresence;
		/** This phone's own seat, whose candle burns red. */
		mySeat?: SeatId;
		/** The names of connected phones with no seat, where the room tells them (the Storyteller). */
		unseatedNames?: readonly string[];
		/**
		 * What the room says of the game, such as "Game over: Good won", at the start of the row;
		 * empty takes no room. A phone also says it is joining or offline here.
		 */
		status?: string;
		/**
		 * Makes the status a button that opens something, such as the Game over sheet
		 * (Trevor, 2026-11-15: rating lives in the status box, no separate button).
		 */
		onStatus?: () => void;
		/** What tapping the status does, in a second, quieter line under it ("Rate this game"). */
		statusAction?: string;
		/** The team that won, once the game is over: the status takes its colour. */
		winner?: 'good' | 'evil';
		/** This phone's seat number, for tests to read; the screen doesn't say it. */
		seatNumber?: number;
		/**
		 * Opens Your character (Trevor, 2026-11-03): while players may see theirs, the game's
		 * status gives its place to it, the same box, so nothing moves. Never once the game is
		 * over (Trevor, 2026-11-15: Game over and Your character never show together).
		 */
		character?: () => void;
		/**
		 * When players stop seeing theirs (epoch ms): Your character counts down to it
		 * (Trevor, 2026-11-12). None while it has no end, such as a seat just given.
		 */
		characterUntil?: number;
		/**
		 * Select seat, in the game status's place as Your character is, so nothing moves: a
		 * phone with a seat to pick, away from the Grim tab where seats are picked (Trevor,
		 * 2026-11-16). A phone with no seat has no character, so the two never meet.
		 */
		selectSeat?: () => void;
		after?: Snippet;
	}

	let {
		table,
		ended = false,
		presence,
		mySeat,
		unseatedNames,
		status,
		onStatus,
		statusAction,
		winner,
		seatNumber,
		character,
		characterUntil,
		selectSeat,
		after
	}: Props = $props();

	const yours = $derived(ended ? undefined : character);
	const seatAsk = $derived(ended || yours ? undefined : selectSeat);
	const characterLeft = timeLeft(() => (yours ? characterUntil : undefined));

	const phase = $derived(ended ? undefined : parsePlayersPhase(table?.now));
	const timer = $derived(ended ? undefined : dayTimers.parsePublicTimer(table?.timer));
	const setupLook = $derived(parseSetupLook(table?.setupLook));
	const candles = $derived(
		setupLook === 'candles' ? seatCandles(table?.seats ?? [], presence, mySeat) : undefined
	);
	const connections = $derived(
		setupLook === 'candles' ? seatConnections(table?.seats ?? [], presence) : undefined
	);
</script>

{#snippet said()}
	<span class="summary" role="status" data-testid="join-status">{status}</span>
	{#if statusAction}<span class="action">{statusAction}</span>{/if}
{/snippet}

{#if status !== undefined || after || phase || yours || seatAsk}
	<div class="status-row" data-testid="player-status-row">
		{#if status !== undefined}
			<!-- With nothing to say the box takes no room, so the game's status starts the row
			     (Trevor, 2026-10-26: "remove the empty space next to the game state tracker"). -->
			{#if onStatus}<button
					type="button"
					class="you"
					class:quiet={!status}
					aria-haspopup="dialog"
					data-testid="you-row"
					data-seat={seatNumber}
					data-team={winner}
					onclick={onStatus}>{@render said()}</button
				>{:else}<p
					class="you"
					class:quiet={!status}
					data-testid="you-row"
					data-seat={seatNumber}
					data-team={winner}
				>
					{@render said()}
				</p>{/if}
		{/if}
		<!-- Where the game is up to, with the day's timer; it shares the row's height, so
		     nothing below moves. -->
		<!-- While players may see theirs, Your character covers the game's status, the same box,
		     so nothing moves (Trevor, 2026-11-03); Select seat does the same (2026-11-16). -->
		{#if phase || yours || seatAsk}<div
				class="game"
				data-covered={yours || seatAsk ? '' : undefined}
			>
				{#if phase}<PlayersDayStatus
						{phase}
						{timer}
						seats={table?.seats ?? []}
						wide
						{setupLook}
						{candles}
						unseated={presence?.unseated ?? 0}
						{connections}
						{unseatedNames}
					/>{/if}
				{#if yours}<button
						type="button"
						class="character"
						class:over={!!phase}
						aria-haspopup="dialog"
						data-testid="your-character"
						onclick={yours}
						><Icon name="yourCharacter" />{characterLeft.ms === undefined
							? t('room.role.open')
							: t('room.role.openTime', { time: clock(characterLeft.ms) })}</button
					>{:else if seatAsk}<button
						type="button"
						class="character"
						class:over={!!phase}
						data-testid="select-seat"
						onclick={seatAsk}><Icon name="arrange" />{t('room.selectSeat')}</button
					>{/if}
			</div>{/if}
		{@render after?.()}
	</div>
{/if}

<style>
	/* As far under the title's byline as the screen's side margin (Trevor, 2026-10-28:
	   "Increase space after author name to status bar"). On /play that is the page gutter,
	   less the --space-4 the Page already leaves under its header; the Storyteller's dialog
	   gives its own (--player-status-gap). */
	.status-row {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		margin-top: var(--player-status-gap, calc(var(--page-gutter) - var(--space-4)));
		margin-bottom: var(--space-2);
	}
	/* The game's status takes the rest of the row (Trevor, 2026-10-27: "the game status bar
	   should then take up the entire horizontal of that line area"). */
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
	/* Your character (or Select seat) in the game status's place, drawn as that box is
	   (PlayersDayStatus). */
	.character {
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-family: var(--font-heading);
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.character.over {
		position: absolute;
		inset: 0;
	}
	.character :global(svg) {
		font-size: 1.5em;
	}
	/* What the room says of the game, in the row over the tabs. */
	.you {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		box-sizing: border-box;
		min-width: 0;
		min-height: var(--tap-target);
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	/* Who won, in their team's colour (Trevor, 2026-11-01). */
	.you[data-team='good'] {
		border-color: var(--good);
		background: var(--good);
		color: var(--on-good);
	}
	.you[data-team='evil'] {
		border-color: var(--evil);
		background: var(--evil);
		color: var(--on-evil);
	}
	button.you {
		flex-direction: column;
		align-items: stretch;
		justify-content: center;
		gap: 0;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	/* The game's end in the theme's display face (Trevor, 2026-11-15: "game over font should
	   be better"); what tapping does under it, in the body face, smaller. */
	.you[data-team] .summary,
	button.you .summary {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.2rem;
		letter-spacing: 0.04em;
	}
	button.you .summary {
		min-height: 0;
	}
	.action {
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-style: italic;
		opacity: 0.85;
	}
	.you.quiet {
		display: none;
	}
	.summary {
		flex: 1;
		min-width: 0;
		min-height: 2.8em;
		margin: 0;
		align-content: center;
	}
</style>
