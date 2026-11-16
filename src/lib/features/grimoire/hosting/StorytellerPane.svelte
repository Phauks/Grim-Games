<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import PlayersPanel from '#lib/features/room/PlayersPanel.svelte';
	import ShowRolesButton from '#lib/features/room/ShowRolesButton.svelte';
	import { sidePane, type PaneTab } from '#lib/features/room/side-pane.svelte.ts';

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
	}

	let { game, run = (command) => game.run(command).ok, day, night }: Props = $props();

	const host = roomHost();
	const notes = $derived(game.game.notes ?? []);
	const viewOnly = $derived(game.viewOnly);
	const unread = $derived(host.code ? host.inbox.unread : 0);

	const tabs = $derived<{ value: PaneTab; label: string; count?: number; warn?: boolean }[]>([
		{ value: 'day', label: t('room.pane.day') },
		{ value: 'night', label: t('room.pane.night') },
		{ value: 'notes', label: t('room.pane.notes') },
		{ value: 'players', label: t('room.players.title'), count: unread, warn: host.inbox.urgent }
	]);
</script>

<div class="storyteller-pane" data-testid="storyteller-pane">
	<Tabs bind:value={sidePane.tab} {tabs} label={t('room.players.pane')}>
		{#snippet panel(tab)}
			{#if tab === 'day'}
				<div class="phase" data-testid="pane-day">{@render day()}</div>
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
					/>
				</div>
			{:else}
				<div class="players">
					<div class="roles"><ShowRolesButton {game} /></div>
					<PlayersPanel {game} {run} />
				</div>
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
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.players {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}
	.roles {
		display: flex;
		justify-content: flex-end;
	}
</style>
