<script lang="ts">
	import type { ScriptMeta } from '#lib/core/data/index.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import { gameClock } from '#lib/core/rules/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { GameInfoChanges } from '#lib/features/modes/GameInfoEditDialog.svelte';
	import ModeMenu from '#lib/features/modes/ModeMenu.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { gameModeNames } from './game-mode-name.ts';

	/**
	 * The board's lower left corner (Trevor, 2026-10-17): the script's name, small and clear of
	 * the seats, with the game's mode and rules, the author, the Storyteller, the join code and
	 * Game time under it, and who watches above it. A player's grim shows the same corner
	 * (plan J13), from its script and Storyteller, with nothing to open or share.
	 */
	interface Props {
		/** The Storyteller's game; a player's grim gives `meta` and `storytellerName` instead. */
		game?: Game;
		meta?: ScriptMeta;
		storytellerName?: string;
		/** A spectator's board: nothing to share or edit. */
		watching?: boolean;
		/** Spectators on this game's view-only link. */
		watcherCount?: number;
		/** How wide the corner may be for a given height, in px (corner-room.ts). */
		fitRoom: (height: number) => number;
		/** The board's width and the root font size, in px. */
		width: number;
		rootFont: number;
		/** The night or day in play, or Setup before the game starts; none on a player's grim. */
		phase?: string;
		/** When the game started and ended, for Game time. */
		startedAt?: number;
		endedAt?: number;
		onEdit?: (changes: GameInfoChanges) => void;
		/** The join code opens Share. */
		onShare?: () => void;
		/** The corner's size, kept clear of reminders. */
		titleW?: number;
		titleH?: number;
		/** How wide the corner may be now; under two rem it is hidden. */
		room?: number;
	}

	let {
		game,
		meta: givenMeta,
		storytellerName,
		watching = false,
		watcherCount = 0,
		fitRoom,
		width,
		rootFont,
		phase,
		startedAt,
		endedAt,
		onEdit,
		onShare,
		titleW = $bindable(0),
		titleH = $bindable(0),
		// eslint-disable-next-line no-useless-assignment -- bindable: the board reads it
		room = $bindable(0)
	}: Props = $props();

	/**
	 * A game played in an alternative mode says so where the script's name is (Trevor,
	 * 2026-10-18), in its own colour; the mode is the game modes thread's (game-mode-store).
	 */
	const modeNames = $derived(game ? gameModeNames(game.gameId) : []);
	const meta = $derived(game ? game.script.meta : givenMeta);
	const storyteller = $derived((game ? game.storytellerName : storytellerName)?.trim());
	/**
	 * A town's script is named after its mode ("Two Towns and a Boomdandy 1"): the name then
	 * says it once, in the mode's colour, rather than twice (Trevor, 2026-10-18).
	 */
	const modeInName = $derived(
		modeNames.length > 0 && (meta?.name ?? '').toLowerCase().startsWith(modeNames[0].toLowerCase())
	);
	/** The mode, then each special rule, a line each under the name (Trevor, 2026-10-19). */
	const modeLines = $derived(modeInName ? modeNames.slice(1) : modeNames);
	/** The join code under the script's name (a Board setting, on by default). */
	const showRoomCode = $derived(!!game && !watching && preferences.current.assistance.roomCode);
	const roomCode = $derived(roomHost().code);
	/**
	 * How long the game has run, from Start game to End game (Trevor, 2026-10-23), under the
	 * join code; None until the first night begins. A Board setting, on by default.
	 */
	const showGameClock = $derived(!!game && !watching && preferences.current.assistance.gameClock);
	/** The night or day in play (Trevor, 2026-10-23), a Board setting, on by default. */
	const showPhase = $derived(phase !== undefined && preferences.current.assistance.boardPhase);
	/** The phase and Game time share one line, so the day or night never costs the corner one. */
	const showClockLine = $derived(showGameClock || showPhase);
	let clockNow = $state(Date.now());
	$effect(() => {
		if (!showGameClock || startedAt === undefined || endedAt !== undefined) return;
		clockNow = Date.now();
		const tick = setInterval(() => (clockNow = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	const gameLengthText = $derived(
		startedAt === undefined
			? t('common.none')
			: gameClock.formatGameLength(gameClock.gameLength(startedAt, clockNow, endedAt))
	);
	// Always shown, unless the script itself asks not to (Trevor, 2026-10-23: "always show
	// script name and author on board, remove as an option").
	const showTitle = $derived(!meta?.hideTitle);

	/** The heights of the mode and rule lines under the script's name. */
	let lineHs = $state<number[]>([]);
	/**
	 * The script's name in the corner keeps clear of every seat and name (Trevor, 2026-10-18),
	 * cut short with an ellipsis where it would reach one (always the lower left).
	 */
	const cornerFit = $derived.by(() => {
		// A line per special rule (Trevor, 2026-10-19) when they all fit; otherwise one line,
		// as before. Both heights come from what is shown now, so the choice never flip-flops.
		const extra = Math.max(0, modeLines.length - 1) * (lineHs[0] ?? 0);
		// Game time takes a line of its own where the corner has room for it; otherwise it
		// shares the join code's line, so the name and rules keep their room.
		const clockShown = showClockLine && clockFits ? clockH : 0;
		const baseH = titleH - clockShown;
		const stackedH = stackRules ? baseH : baseH + extra;
		const stacked = fitRoom(stackedH);
		const stack = extra > 0 && stacked >= 2 * rootFont;
		const h = stack ? stackedH : stackRules ? baseH - extra : baseH;
		const withClock = fitRoom(h + clockH);
		if (showClockLine && (withClock >= 2 * rootFont || !showRoomCode))
			return { room: withClock, stack, clock: true };
		return { room: stack ? stacked : fitRoom(h), stack, clock: false };
	});
	/** Whether Game time has a line of its own now; follows cornerFit, as stackRules does. */
	// eslint-disable-next-line svelte/prefer-writable-derived -- cornerFit reads it back, so a derived would be circular
	let clockFits = $state(true);
	$effect(() => {
		clockFits = cornerFit.clock;
	});
	/** The Game time line's height, kept while it shares a line so its fit can be judged again. */
	let clockH = $state(0);
	/** Whether the rules show a line each now; follows cornerFit once the lines are measured. */
	// eslint-disable-next-line svelte/prefer-writable-derived -- cornerFit reads it back, so a derived would be circular
	let stackRules = $state(false);
	$effect(() => {
		stackRules = cornerFit.stack;
	});
	$effect.pre(() => {
		room = cornerFit.room;
	});
</script>

<!-- The day or night, then Game time: on a line of their own, or after the join code where the
     corner has no line to spare (shared), where Game time's label is for screen readers only. -->
{#snippet clockLine(shared: boolean)}
	{#if showPhase}<span data-testid="board-phase">{phase}</span>{/if}{#if showPhase && showGameClock}
		·
	{/if}{#if showGameClock}<span data-testid="board-game-clock"
			>{#if shared}<span class="visually-hidden">{t('history.gameLength')}</span>{:else}{t(
					'history.gameLength'
				)}{/if}
			<span class="code" role="timer">{gameLengthText}</span></span
		>{/if}
{/snippet}

{#if showTitle && meta?.name}
	<!-- Small in the lower left corner, clear of the seats (Trevor, 2026-10-17). -->
	<p
		class="corner-title"
		style:max-width={width > 0 ? `${(cornerFit.room / width) * 100}%` : undefined}
		class:no-room={width > 0 && cornerFit.room < 2 * rootFont}
		data-testid="script-title"
		bind:clientWidth={titleW}
		bind:clientHeight={titleH}
	>
		<!-- Who watches the view-only grimoire, above the name (Trevor, 2026-10-22); held
		     off the title's own height so the corner's measurements stay as they are. -->
		{#if watcherCount > 0}<span
				class="watchers"
				role="status"
				aria-label={t('room.watching', { count: watcherCount })}
				data-testid="board-watchers"
				><Icon name="watchers" /><span aria-hidden="true">{watcherCount}</span></span
			>{/if}
		<!-- A mode's name opens its actions (Alternative game modes, Trevor 2026-10-18). -->
		{#if game}<ModeMenu
				{game}
				onEdit={watching ? undefined : onEdit}
				{startedAt}
				{endedAt}
				{phase}
				{watcherCount}
				onShare={watching ? undefined : onShare}
				><span
					class="script-name"
					class:mode={modeInName}
					data-testid={modeInName ? 'game-mode' : undefined}>{meta.name}</span
				></ModeMenu
			>{:else}<span class="script-name">{meta.name}</span>{/if}
		<!-- The mode and rules take the author's line: a line each where the corner has room
		     for them all (corner-room.ts), else one line joined with " + ". -->
		{#each stackRules ? modeLines : modeLines.length ? [modeLines.join(' + ')] : [] as line, i (i)}<span
				class="mode"
				data-testid="game-mode"
				bind:clientHeight={lineHs[i]}>{line}</span
			>{:else}{#if meta.author}<span class="author">by {meta.author}</span>{/if}{/each}
		<!-- Who runs the game, under the author (Trevor, 2026-10-23); no line when unnamed. -->
		{#if storyteller}<span class="author" data-testid="board-storyteller"
				>{t('settings.storytellerLine', { name: storyteller })}</span
			>{/if}
		<!-- The room's join code, to read without opening Share (Trevor, 2026-10-22). Kept in
		     place before a room opens, so nothing moves when its code arrives. -->
		{#if showRoomCode}<button
				type="button"
				class="room-code"
				data-testid="board-room-code"
				onclick={onShare}
				><span class="room-code-line"
					>{t('room.joinCode')}
					<span class="code">{roomCode ? formatRoomCode(roomCode) : t('common.none')}</span
					>{#if showClockLine && !clockFits}
						· {@render clockLine(true)}{/if}</span
				></button
			>{/if}
		<!-- The game's length (Trevor, 2026-10-23), kept in place before the first night so
		     nothing moves when it starts. -->
		{#if showClockLine && clockFits}<span
				class="game-clock"
				bind:clientHeight={() => clockH, (h) => (h > 0 ? (clockH = h) : undefined)}
				>{@render clockLine(false)}</span
			>{/if}
	</p>
{/if}

<style>
	/* The game mode, apart from the script: small capitals in the accent colour. */
	.mode {
		color: var(--accent);
		font-family: var(--font-control);
		font-variant: small-caps;
		letter-spacing: 0.08em;
	}
	.corner-title .mode {
		font-size: 0.8em;
	}
	.corner-title {
		position: absolute;
		left: var(--space-1);
		bottom: var(--space-1);
		z-index: 1;
		display: grid;
		/* Until the board is measured; then as wide as the corner's room (corner-room.ts). */
		max-width: 32%;
		margin: 0;
		font-family: var(--font-heading);
		line-height: 1.15;
		color: var(--heading);
		/* Straight on the board, with no band behind it, so a faint halo keeps it readable on
		   any background or image (Trevor, 2026-10-23). */
		text-shadow: 0 0 0.3em var(--surface);
		pointer-events: none;
	}
	.watchers {
		position: absolute;
		left: 0;
		bottom: 100%;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-control);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.corner-title.no-room {
		visibility: hidden;
	}
	/* One line each, cut short rather than wrapping up into the seats (Trevor, 2026-10-18). */
	.corner-title > span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.corner-title .script-name {
		font-size: 0.9rem;
	}
	.corner-title .author {
		font-size: 0.7rem;
		color: var(--on-surface-muted);
	}
	.room-code {
		position: relative;
		display: block;
		min-width: 0;
		/* Text high, as the mode name (ModeMenu); the ::before keeps the tap target. */
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		font-size: 0.7rem;
		text-align: inherit;
		cursor: pointer;
		/* The corner lets taps through to the board; its buttons take them. */
		pointer-events: auto;
	}
	/* Read only, in the join code's look, one line. */
	.game-clock {
		display: block;
		overflow: hidden;
		color: var(--on-surface-muted);
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.room-code .code,
	.game-clock .code {
		color: var(--on-surface);
		font-family: var(--font-control);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
	}
	/* A tap target bigger than the small corner text, without moving anything (ModeMenu). */
	/* One line, cut short like the corner's other lines: wrapping would make the corner taller
	   as its room shrinks, and the room would shrink again (corner-room.ts). */
	.room-code-line {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.room-code::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
</style>
