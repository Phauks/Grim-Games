<script lang="ts">
	import { prepareRoom, roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import GameLead from '#lib/features/shell/GameLead.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Snippet } from 'svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { SeatArranging } from './seat-arranging.svelte.ts';
	import { leaveSeating } from './seating-mode.svelte.ts';

	/**
	 * The bar over the board: the app's navigation and the grim cover, then Day, Info tokens,
	 * Script, Share and More (with Messages inside). Arranging seats or placing one swaps in their own controls, at the same
	 * height, so the board never moves.
	 */
	interface Props {
		grimoire: Grimoire;
		/** A spectator sees every control, disabled. */
		watching: boolean;
		/** More opens, even on a spectator's board that lets it look through History. */
		menu: boolean;
		seatArr: SeatArranging;
		/** A new seat waits for its place on the board. */
		placing: boolean;
		onCancelPlacing: () => void;
		/** The Grimoire is shown to a player: nothing over it but the X that ends it. */
		showing?: boolean;
		onStopShowing?: () => void;
		onDay: () => void;
		onInfo: () => void;
		onScript: () => void;
		onShare: () => void;
		onMore: () => void;
		/** Beside ☰: the grim cover, in the same place on the board and the day (Trevor). */
		lead?: Snippet;
	}

	let {
		grimoire,
		watching,
		menu,
		seatArr,
		placing,
		onCancelPlacing,
		showing = false,
		onStopShowing,
		onDay,
		onInfo,
		onScript,
		onShare,
		onMore,
		lead
	}: Props = $props();
	const host = roomHost();
	/** Players' messages and reported pictures still to see (Trevor, 2026-10-27). */
	const unread = $derived(host.code ? host.inbox.unread : 0);
</script>

<!-- Left out of the board's picture (screenshot.ts): it is the app's, not the game's. -->
<div class="toolbar" role="toolbar" aria-label="Grimoire" data-screenshot="skip">
	{#if seatArr.arranging}
		<span class="title arranging-title">{t('room.seating.title')}</span>
		<span class="spacer"></span>
		<IconButton
			icon="undo"
			label="Rotate players anticlockwise"
			onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'anticlockwise' })}
		/>
		<IconButton
			icon="redo"
			label="Rotate players clockwise"
			onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'clockwise' })}
		/>
		<Button
			variant="quiet"
			disabled={Object.keys(grimoire.layout.placed).length === 0 &&
				Object.keys(grimoire.layout.gaps).length === 0}
			onclick={() => seatArr.spread()}>Spread evenly</Button
		>
		<Button
			variant="accent"
			icon="check"
			data-way-back
			onclick={() => leaveSeating(seatArr, grimoire)}>Done</Button
		>
	{:else if placing}
		<span class="title">Add a seat</span>
		<Button variant="quiet" icon="close" onclick={onCancelPlacing}>Cancel</Button>
	{:else if showing}
		<!-- Only the X, top right, so the player sees nothing of the Storyteller's controls
		     (Trevor, 2026-10-30). -->
		<span class="spacer"></span>
		<IconButton icon="close" label="Close" onclick={onStopShowing} />
	{:else}
		<!-- ☰ and the cover, in the same spot as on the day's sheet (GameLead). -->
		<GameLead {watching}>{@render lead?.()}</GameLead>
		<!-- Icons on phones; with their words on wider screens, where there is room. A
		     spectator's board says what it is in that room (Trevor, 2026-10-19). -->
		<span class="spacer"
			>{#if watching}<span class="view-only" data-testid="view-only">View-Only</span>{/if}</span
		>
		<!-- A spectator sees every control the Storyteller does, disabled (Trevor, 2026-10-19):
		     nothing opens, so nothing invites a try. Script only shows the players' copy. -->
		<Button variant="quiet" icon="day" aria-label="Day" disabled={watching} onclick={onDay}
			><span class="tool-label">Day</span></Button
		>
		<Button
			variant="quiet"
			icon="info"
			aria-label="Info tokens"
			disabled={watching}
			onclick={onInfo}><span class="tool-label">Info tokens</span></Button
		>
		<!-- The players' copy of the script, exactly as /play shows it (Trevor, 2026-10-16),
		     before Share (Trevor, 2026-10-23). -->
		<Button variant="quiet" icon="script" aria-label="Script" onclick={onScript}
			><span class="tool-label">Script</span></Button
		>
		<!-- Sharing is never hidden in the menu (Trevor, 2026-10-16). Pointing at, focusing or
		     pressing it starts opening the room, so the code and QR are ready. -->
		<Button
			variant="quiet"
			icon="share"
			aria-label="Share"
			disabled={watching}
			onpointerenter={prepareRoom}
			onfocus={prepareRoom}
			onpointerdown={prepareRoom}
			onclick={onShare}><span class="tool-label">Share</span></Button
		>
		<!-- Players' messages and reported pictures are in More on every screen, which carries
		     their count (Trevor, 2026-10-28: "we should not have discrepancy, keep in ..."). -->
		<Button
			variant="quiet"
			icon="more"
			aria-label={unread ? `More, ${t('room.inbox.unread', { count: unread })}` : 'More'}
			disabled={!menu}
			onclick={onMore}
			><span class="tool-label">More</span>{#if unread}<span class="count"
					><CountBadge count={unread} warn /></span
				>{/if}</Button
		>
	{/if}
</div>

<style>
	.toolbar {
		/* A fixed height, so swapping in the arranging controls never moves the board. */
		flex: none;
		box-sizing: border-box;
		height: calc(var(--tap-target) + var(--space-2));
		display: flex;
		align-items: center;
		/* One spacing step everywhere (Trevor, 2026-10-16): the same inset from the screen's
	   top and sides as the board's margin, and between buttons, narrowing only on the
	   smallest phones so six buttons still fit at 320px. No dividing line: the dashed
	   outline shows the board's edge while arranging. */
		gap: var(--menu-gap);
		padding: var(--menu-inset) var(--menu-inset) 0;
	}
	/* Over a background, the toolbar's buttons get the reminder bank's backing, so they read
   on any image (Trevor, 2026-10-18). */
	:global(.grimoire:has(> .backdrop))
		.toolbar
		:global(button:not([data-variant='accent']):not([data-variant='danger'])) {
		background: var(--board-bar-background);
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-heading);
		color: var(--heading);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.spacer {
		flex: 1;
		min-width: 0;
		text-align: center;
	}
	.view-only {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--evil-text);
		font-family: var(--font-heading);
		font-weight: 700;
	}
	@media (max-width: 479.98px) {
		/* On a phone the arranging controls need the whole bar. */
		.arranging-title {
			display: none;
		}
	}
	/* A count on a button's corner, so the button keeps its size. It sits inside the button,
	   since ⋯ is at the screen's edge and a count over its corner was cut off (Trevor,
	   2026-10-28). */
	.toolbar :global(.button:has(> .count)) {
		position: relative;
	}
	.count {
		position: absolute;
		top: 0.15em;
		right: 0.15em;
		font-size: 0.75rem;
		pointer-events: none;
	}
	/* Solid, so the board's background never shows through; the day timer on the board has
	   the same fill and edge (Trevor, 2026-10-23). A hover still shows its wash. */
	.toolbar :global(.button[data-variant='quiet']:not(:hover)),
	.toolbar :global(.icon-button[data-outlined]:not([aria-pressed='true'])) {
		background: var(--surface);
	}
	/* Phones show the toolbar's icons only; wider screens add the words. */
	.toolbar :global(.tool-label) {
		display: none;
	}
	@media (max-width: 719.98px) {
		.toolbar :global(.button:has(.tool-label)) {
			min-width: var(--tap-target);
			padding: 0;
			gap: 0;
		}
	}
	@media (min-width: 720px) {
		.toolbar :global(.tool-label) {
			display: inline;
		}
	}
</style>
