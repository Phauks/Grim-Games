<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import type { Snippet } from 'svelte';
	import type { ScriptMeta } from '#lib/core/data/index.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import { gameClock } from '#lib/core/rules/index.ts';
	import type { PublicCorner } from '#lib/core/sync/public-projection.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { GameInfoChanges } from '#lib/features/modes/GameInfoEditDialog.svelte';
	import ModeMenu from '#lib/features/modes/ModeMenu.svelte';
	import TownGameInfo from '#lib/features/modes/TownGameInfo.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { phaseText } from './phase-text.ts';

	/**
	 * The board's lower left corner (Trevor, 2026-10-17): the script's name, small and clear of
	 * the seats, with the game's mode and rules, the author, the Storyteller, the join code and
	 * Game time under it, and who watches above it. A player's grim shows the same corner
	 * (plan J13), from its script and the lines the Storyteller's board sends (corner-lines.ts);
	 * its name opens a read-only Game info (TownGameInfo) and nothing is shared.
	 */
	interface Props {
		/** The Storyteller's game; a player's grim gives `meta` and `storytellerName` instead. */
		game?: Game;
		meta?: ScriptMeta;
		storytellerName?: string;
		/** A spectator's board: nothing to share or edit. */
		watching?: boolean;
		/** A player's grim: its name opens Game info, read only, for this room (TownGameInfo). */
		townInfo?: { roomCode?: string };
		/** The lines under the name, as the Storyteller's board shows them (corner-lines.ts). */
		corner?: PublicCorner;
		/** The join code to show; the room this device runs, if not given. */
		roomCode?: string;
		/** The script's logo before its name, on a player's grim (Trevor, 2026-10-24). */
		logo?: string;
		/** How wide the corner may be for a given height, in px (corner-room.ts). */
		fitRoom: (height: number) => number;
		/** The board's width and the root font size, in px. */
		width: number;
		rootFont: number;
		/** When the game started and ended, for the Game info sheet. */
		startedAt?: number;
		endedAt?: number;
		/** The night or day in play, for the Game info sheet (ModeMenu). */
		gamePhase?: string;
		onEdit?: (changes: GameInfoChanges) => void;
		/** Game info's join code opens Share (ModeMenu). */
		onShare?: () => void;
		/** The corner's size, kept clear of reminders. */
		titleW?: number;
		titleH?: number;
		/** How wide the corner may be now; under two rem it is hidden. */
		room?: number;
		/**
		 * A status above the corner, out of the corner's own size (the board's Game over:
		 * Trevor, 2026-10-25, so History's strip keeps its room for the change shown).
		 */
		status?: Snippet;
	}

	let {
		game,
		meta: givenMeta,
		storytellerName,
		watching = false,
		townInfo,
		corner,
		roomCode: givenCode,
		logo,
		fitRoom,
		width,
		rootFont,
		startedAt,
		endedAt,
		gamePhase,
		onEdit,
		onShare,
		titleW = $bindable(0),
		titleH = $bindable(0),
		// eslint-disable-next-line no-useless-assignment -- bindable: the board reads it
		room = $bindable(0),
		status
	}: Props = $props();

	/**
	 * A game played in an alternative mode says so where the script's name is (Trevor,
	 * 2026-10-18), in its own colour; the mode is the game modes thread's (game-mode-store).
	 */
	const modeNames = $derived(corner?.modes ?? []);
	const watcherCount = $derived(corner?.watchers ?? 0);
	const meta = $derived(game ? game.script.meta : givenMeta);
	// Each line has an eye in Game info and Settings > Board (corner-lines.ts); the name always shows.
	const author = $derived(corner?.author === false ? undefined : meta?.author);
	const version = $derived(corner?.version);
	const players = $derived(corner?.players);
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
	const showRoomCode = $derived(!!corner?.joinCode);
	const roomCode = $derived(givenCode ?? roomHost().code);
	/**
	 * How long the game has run, from Start game to End game (Trevor, 2026-10-23), under the
	 * join code; "Game time: Setup" until the first night begins (Trevor, 2026-10-24).
	 */
	const showGameClock = $derived(!!corner?.gameTime);
	const clockStart = $derived(corner?.gameTime?.startedAt);
	const clockEnd = $derived(corner?.gameTime?.endedAt);
	/**
	 * The night or day in play (Trevor, 2026-10-23): a line of its own with its own eye, above
	 * Game time (Trevor, 2026-10-26). Setup before the first night, so nothing moves then.
	 */
	const begun = $derived(!!corner?.gameTime?.begun);
	const showPhase = $derived(!!corner?.phase);
	const phase = $derived(corner?.phase ? phaseText(corner.phase) : undefined);
	/** The day or night and Game time, kept together where the corner has room for them. */
	const showClockLine = $derived(showGameClock || showPhase);
	/** Between lines that share one: Svelte trims plain spaces at a block's edges. */
	const SEPARATOR = ' · ';
	let clockNow = $state(Date.now());
	$effect(() => {
		if (!showGameClock || clockStart === undefined || clockEnd !== undefined) return;
		clockNow = Date.now();
		const tick = setInterval(() => (clockNow = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	const gameLengthText = $derived(
		// 0:00 before the first night, in place so nothing moves when it starts: Game phase
		// says Setup (Trevor, 2026-10-26: "game time should no longer say setup").
		!begun
			? gameClock.formatGameLength(0)
			: clockStart === undefined
				? t('common.none')
				: gameClock.formatGameLength(
						gameClock.gameLength(clockStart, Math.max(clockNow, clockStart), clockEnd)
					)
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

<!-- The day or night, then Game time: a line each, or after the join code where the corner has
     no lines to spare (shared), where Game time's label is for screen readers only. -->
{#snippet clockLine(shared: boolean)}
	{#if showPhase}<span data-testid="board-phase" class:line={!shared}>{phase}</span
		>{/if}{#if shared && showPhase && showGameClock}{SEPARATOR}{/if}{#if showGameClock}<span
			data-testid="board-game-clock"
			class:line={!shared}
			>{#if shared}<span class="visually-hidden">{t('history.gameLength')}</span>{:else}{t(
					'history.gameLength'
				)}:{/if}
			<span class="code" role="timer">{gameLengthText}</span></span
		>{/if}
{/snippet}

{#snippet nameLine()}<span class="name-line"
		>{#if logo}<ScriptLogo src={logo} class="corner-logo" />{/if}<span
			class="script-name"
			class:mode={modeInName}
			data-testid={modeInName ? 'game-mode' : undefined}>{meta?.name}</span
		></span
	>{/snippet}

{#snippet codeLine()}
	<span class="room-code-line"
		>{t('room.joinCode')}
		<span class="code">{roomCode ? formatRoomCode(roomCode) : t('common.none')}</span
		>{#if showClockLine && !clockFits}{SEPARATOR}{@render clockLine(true)}{/if}</span
	>
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
		<!-- The status, then who watches the view-only grimoire, above the name (Trevor,
		     2026-10-22); held off the title's own height so the corner's measurements stay as
		     they are. -->
		{#if status || watcherCount > 0}<span class="above"
				>{@render status?.()}{#if watcherCount > 0}<span
						class="watchers"
						role="status"
						aria-label={t('room.watching', { count: watcherCount })}
						data-testid="board-watchers"
						><Icon name="watchers" /><span aria-hidden="true"
							><CountBadge count={watcherCount} /></span
						></span
					>{/if}</span
			>{/if}
		<!-- A mode's name opens its actions (Alternative game modes, Trevor 2026-10-18). -->
		{#if game}<ModeMenu
				{game}
				onEdit={watching ? undefined : onEdit}
				{startedAt}
				{endedAt}
				phase={gamePhase}
				{watcherCount}
				onShare={watching ? undefined : onShare}
				><span
					class="script-name"
					class:mode={modeInName}
					data-testid={modeInName ? 'game-mode' : undefined}>{meta.name}</span
				></ModeMenu
			>{:else if townInfo}<!-- A player's grim opens Game info from the name too (Trevor,
			     2026-10-30), with the Storyteller's profile in it. --><TownGameInfo
				{meta}
				storytellerName={storyteller}
				{corner}
				roomCode={townInfo.roomCode}>{@render nameLine()}</TownGameInfo
			>{:else}{@render nameLine()}{/if}
		<!-- The mode and rules take the author's line: a line each where the corner has room
		     for them all (corner-room.ts), else one line joined with " + ". -->
		{#each stackRules ? modeLines : modeLines.length ? [modeLines.join(' + ')] : [] as line, i (i)}<span
				class="mode"
				data-testid="game-mode"
				bind:clientHeight={lineHs[i]}>{line}</span
			>{:else}{#if author}<span class="author">by {author}</span>{/if}{/each}
		{#if version}<span class="author" data-testid="board-version"
				>{t('modes.info.version')}: {version}</span
			>{/if}
		{#if players}<span class="author" data-testid="board-players"
				>{t('modes.info.players')}: {players}</span
			>{/if}
		<!-- Who runs the game, under the author (Trevor, 2026-10-23); no line when unnamed. -->
		{#if storyteller && corner?.storyteller !== false}<span
				class="author"
				data-testid="board-storyteller">{t('settings.storytellerLine', { name: storyteller })}</span
			>{/if}
		<!-- The room's join code, to read without opening Share (Trevor, 2026-10-22). Kept in
		     place before a room opens, so nothing moves when its code arrives. Read only: Share
		     is the toolbar's Share button (Trevor, 2026-10-24). -->
		{#if showRoomCode}<span class="room-code" data-testid="board-room-code"
				>{@render codeLine()}</span
			>{/if}
		<!-- The game's length (Trevor, 2026-10-23), kept in place before the first night so
		     nothing moves when it starts. -->
		{#if showClockLine && clockFits}<span
				class="game-clock"
				bind:clientHeight={() => clockH, (h) => (h > 0 ? (clockH = h) : undefined)}
				>{@render clockLine(false)}</span
			>{/if}
	</p>
{:else if status}
	<p class="corner-title corner-status">{@render status()}</p>
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
		/* Clear of the camera and corners when its part fills the screen (FullScreenStage). */
		left: var(--edge-left, var(--space-1));
		bottom: var(--edge-bottom, var(--space-1));
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
	/* Above the corner, as wide as it needs: the corner's room is for the name. Shown even
	   where the name has no room, and tappable though the corner is not. */
	.corner-title > .above {
		position: absolute;
		left: 0;
		bottom: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		width: max-content;
		max-width: 70vw;
		padding-bottom: var(--space-1);
		overflow: visible;
		visibility: visible;
		pointer-events: auto;
	}
	.corner-status {
		max-width: 70vw;
		pointer-events: auto;
	}
	.watchers {
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
	/* The logo, then the name cut short beside it. */
	.name-line {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.name-line .script-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.name-line :global(.corner-logo) {
		width: 1.6rem;
		height: 1.6rem;
	}
	.corner-title .author {
		font-size: 0.7rem;
		color: var(--on-surface-muted);
	}
	.room-code {
		display: block;
		min-width: 0;
		color: var(--on-surface-muted);
		font-size: 0.7rem;
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
	.game-clock .line {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.room-code .code,
	.game-clock .code {
		color: var(--on-surface);
		font-family: var(--font-control);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
	}
	/* One line, cut short like the corner's other lines: wrapping would make the corner taller
	   as its room shrinks, and the room would shrink again (corner-room.ts). */
	.room-code-line {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
