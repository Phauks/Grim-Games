<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import StorytellerPane from './hosting/StorytellerPane.svelte';

	/**
	 * The Storyteller's Game notes and Players, beside the grim cover and styled like it (Trevor,
	 * 2026-11-01: "place the notes button next to the grim cover button"). On the board it shows
	 * and hides their pane (plan M86, Trevor 2026-11-15: "move the players button out of ... and
	 * into the header"), with a count of what waits from players, so it never leaves the bar;
	 * on the day it opens them over the screen.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		outlined?: boolean;
		/** The board's: the pane's own button, pressed while it shows. */
		board?: boolean;
	}

	let {
		game,
		run = (command) => game.run(command).ok,
		outlined = false,
		board = false
	}: Props = $props();

	const host = roomHost();
	const unread = $derived(host.code ? host.inbox.unread : 0);
	const label = $derived(
		unread
			? `${t('room.players.pane')}, ${t('room.inbox.unread', { count: unread })}`
			: t('room.players.pane')
	);
	let local = $state(false);
</script>

<span class="notes-slot"
	><IconButton
		icon="notes"
		{label}
		data-testid="game-notes-button"
		{outlined}
		aria-pressed={board ? sidePane.open : undefined}
		onclick={() => (board ? sidePane.toggle() : (local = true))}
	/>{#if unread}<span class="count"><CountBadge count={unread} warn={host.inbox.urgent} /></span
		>{/if}</span
>
{#if !board}
	<Dialog bind:open={local} title={t('room.players.pane')} size="full" scroll={false}>
		<StorytellerPane {game} {run} />
	</Dialog>
{/if}

<style>
	/* The count sits inside the button's corner, as More's did, so the button keeps its size. */
	.notes-slot {
		position: relative;
		display: inline-flex;
		flex: none;
	}
	.count {
		position: absolute;
		top: 0.15em;
		right: 0.15em;
		font-size: 0.75rem;
		pointer-events: none;
	}
</style>
