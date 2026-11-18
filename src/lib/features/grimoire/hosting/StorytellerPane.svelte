<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import PlayersPanel from '#lib/features/room/PlayersPanel.svelte';
	import { sidePane, type PaneTab } from '#lib/features/room/side-pane.svelte.ts';
	import DayCounts from '#lib/features/day/DayCounts.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';

	/**
	 * The Storyteller's Day, Night, Game notes and Players as tabs (plan M86, Trevor 2026-11-15:
	 * "I really like seeing the notes right next to the game grim"; 2026-11-16: the day and the
	 * night there too, so the grim is the home screen), beside the board where there is room and
	 * in a full-screen sheet on a phone. Players' tab counts what waits from them.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		/** The Day tab's contents, from the board. */
		day: Snippet;
		/** The Night tab's contents, from the board. */
		night: Snippet;
		/** The game is over: Players' feedback opens. */
		ended?: boolean;
	}

	let {
		game,
		run = (command) => game.run(command).ok,
		day,
		night,
		ended = false
	}: Props = $props();
	const live = $derived(new LiveDay(game));

	const host = roomHost();
	const notes = $derived(game.game.notes ?? []);
	const viewOnly = $derived(game.viewOnly);
	const unread = $derived(host.code ? host.inbox.unread : 0);

	const tabs = $derived<{ value: PaneTab; label: string; count?: number; warn?: boolean }[]>([
		{ value: 'day', label: t('room.pane.day') },
		{ value: 'night', label: t('room.pane.night') },
		{ value: 'players', label: t('room.players.title'), count: unread, warn: host.inbox.urgent },
		// Notes last (Trevor, 2026-11-18: "swap players and notes in the top, notes should be last").
		{ value: 'notes', label: t('room.pane.notes') }
	]);
</script>

<div class="storyteller-pane" data-testid="storyteller-pane">
	<Tabs bind:value={sidePane.tab} {tabs} label={t('room.players.pane')} segmented>
		{#snippet panel(tab)}
			{#if tab === 'day'}
				<!-- The day's counts head the Day tab only (Trevor, 2026-11-18: "the pills should just
				     be in day view"); which day it is, game info already says. -->
				<div class="phase" data-testid="pane-day">
					<div class="game-line"><DayCounts game={live} onBoard={sidePane.beside} /></div>
					{@render day()}
				</div>
			{:else if tab === 'night'}
				<div class="phase" data-testid="pane-night">{@render night()}</div>
			{:else if tab === 'notes'}
				<!-- Each written where it sits (Trevor, 2026-11-02). -->
				<div class="notes" data-testid="game-notes">
					<NoteList
						{notes}
						readonly={viewOnly}
						onSave={(note) => !viewOnly && run({ type: 'SetGameNote', ...note })}
						onDelete={(noteId) => !viewOnly && run({ type: 'DeleteGameNote', noteId })}
						hideable={false}
					/>
				</div>
			{:else}
				<div class="players"><PlayersPanel {game} {run} {ended} /></div>
			{/if}
		{/snippet}
	</Tabs>
</div>

<style>
	/* The tabs fill the pane, so Players' list and chosen player each scroll on their own. */
	.storyteller-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.game-line {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 var(--pane-gutter, 0rem) var(--space-2);
	}
	.game-line > :global(.counts) {
		flex: 1;
		min-width: 0;
	}
	/* --pane-gutter: the pane's side inset, given by where it sits, inside each scroll box. */
	.storyteller-pane :global([data-scope='tabs'][data-part='root'] > :has(> [data-part='list'])) {
		margin-inline: var(--pane-gutter, 0rem);
	}
	.storyteller-pane > :global([data-scope='tabs'][data-part='root']) {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.storyteller-pane :global([data-scope='tabs'][data-part='content']:not([hidden])) {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		padding-top: var(--space-2);
	}
	.phase {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.notes {
		padding-inline: var(--pane-gutter, 0rem);
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		/* Room kept for the scrollbar, so nothing moves as it comes and goes (Trevor, 2026-11-17). */
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
	}
	/* Players scrolls itself, with the gutter inside its own scroll box. */
	.players {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}
</style>
