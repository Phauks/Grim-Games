<script lang="ts">
	import ThemePanel from '#lib/features/settings/ThemePanel.svelte';
	import type { Snippet } from 'svelte';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import PlayersPanel from '#lib/features/room/PlayersPanel.svelte';
	import {
		PANE_VIEWS,
		sidePane,
		type PaneSubject,
		type PaneView
	} from '#lib/features/room/side-pane.svelte.ts';
	import DayCounts from '#lib/features/day/DayCounts.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';

	/**
	 * The Storyteller's pane (plan M86; the grim as the home screen, Trevor 2026-11-16), beside
	 * the board where there is room and in a full-screen sheet on a phone. Three subjects, each
	 * with a smaller rail of its own views under it (Trevor, 2026-11-18: "i like nav with
	 * sub-nav"; "only game, players, and more"): Game, the day and night; Players, them and the
	 * notes; More, what the board's ⋯ menu held. History is in More, as it shouldn't be touched
	 * often (Trevor, 2026-11-18). Players counts what waits from them.
	 *
	 * A spectator gets the same pane, to read (Trevor, 2026-11-18): Game's Day and Bluffs, and
	 * More's History and Session, without the night's steps, the players, the seats or sounds.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		/** The Day's contents, from the board. */
		day: Snippet;
		/** The Night's contents, from the board; a spectator's pane has none. */
		night?: Snippet;
		/** The game is over: Players' feedback opens. */
		ended?: boolean;
		/** The Demon's bluffs; none in a mode without them (Sushi Buffet, Whale Buffet). */
		bluffs?: Snippet;
		/** More's views, from the board; a spectator's pane has no Seats or Sounds. */
		seats?: Snippet;
		sounds?: Snippet;
		history: Snippet;
		session: Snippet;
		/** A spectator's pane: only what they may read. */
		watching?: boolean;
	}

	let {
		game,
		run = (command) => game.run(command).ok,
		day,
		night,
		ended = false,
		bluffs,
		seats,
		sounds,
		history,
		session,
		watching = false
	}: Props = $props();
	const live = $derived(new LiveDay(game));

	const host = roomHost();
	const notes = $derived(game.game.notes ?? []);
	const viewOnly = $derived(game.viewOnly);
	const unread = $derived(host.code ? host.inbox.unread : 0);

	const labels: Record<PaneView, string> = {
		day: t('room.pane.day'),
		night: t('room.pane.night'),
		bluffs: t('room.pane.bluffs'),
		players: t('room.players.title'),
		notes: t('room.pane.notes'),
		seats: t('room.pane.seats'),
		sounds: t('room.pane.sounds'),
		theme: t('settings.theme.title'),
		history: t('room.pane.history'),
		session: t('room.pane.session')
	};
	const subjects = $derived<
		{ value: PaneSubject; label: string; count?: number; warn?: boolean }[]
	>([
		{ value: 'game', label: t('room.pane.game') },
		...(watching
			? []
			: [
					{
						value: 'players' as const,
						label: t('room.players.title'),
						count: unread,
						warn: host.inbox.urgent
					}
				]),
		{ value: 'more', label: t('room.pane.more') }
	]);
	/** What a view needs from the board; a spectator's board gives no Night, Seats or Sounds. */
	const given = $derived<Partial<Record<PaneView, unknown>>>({ bluffs, night, seats, sounds });
	function viewsOf(subject: PaneSubject): PaneView[] {
		return (PANE_VIEWS[subject] as readonly PaneView[]).filter(
			(view) => !(view in given) || given[view]
		);
	}
	function views(subject: PaneSubject) {
		return viewsOf(subject).map((view) => ({ value: view, label: labels[view] }));
	}
	// A spectator's pane shows what it has: Game in place of Players, Day in place of Night (the
	// store is the Storyteller's too, and keeps its choice).
	const subject = $derived(
		subjects.some((own) => own.value === sidePane.subject) ? sidePane.subject : 'game'
	);
	function viewIn(subject: PaneSubject): PaneView {
		const own = viewsOf(subject);
		return own.includes(sidePane.views[subject]) ? sidePane.views[subject] : own[0];
	}
</script>

<div class="storyteller-pane" data-testid="storyteller-pane">
	<!-- The day's counts head the pane on every view (Trevor, 2026-11-20: "they should be on every
	     screen on the top"); which day it is, game info already says. On a phone they are in the
	     sheet's header instead (BoardPane). -->
	{#if sidePane.beside}<div class="game-line"><DayCounts game={live} onBoard /></div>{/if}
	<Tabs
		bind:value={() => subject, (value) => (sidePane.subject = value)}
		tabs={subjects}
		label={t('room.players.pane')}
		segmented
	>
		{#snippet panel(subject)}
			<div class="subject">
				<Tabs
					bind:value={() => viewIn(subject), (value) => (sidePane.views[subject] = value)}
					tabs={views(subject)}
					label={t('room.pane.views', {
						subject: subjects.find((s) => s.value === subject)?.label ?? ''
					})}
					segmented="minor"
				>
					{#snippet panel(view)}
						{#if view === 'day'}
							<div class="phase" data-testid="pane-day">
								{@render day()}
							</div>
						{:else if view === 'night'}
							<div class="phase" data-testid="pane-night">{@render night?.()}</div>
						{:else if view === 'bluffs'}
							<div class="phase">{@render bluffs?.()}</div>
						{:else if view === 'players'}
							<div class="players"><PlayersPanel {game} {run} {ended} /></div>
						{:else if view === 'notes'}
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
						{:else if view === 'seats'}
							<div class="phase">{@render seats?.()}</div>
						{:else if view === 'sounds'}
							<div class="phase">{@render sounds?.()}</div>
						{:else if view === 'theme'}
							<!-- The board's looks beside the board, their preview (Trevor, 2026-11-18). -->
							<div class="notes" data-testid="pane-theme"><ThemePanel /></div>
						{:else if view === 'history'}
							<div class="phase">{@render history()}</div>
						{:else}
							<div class="phase">{@render session()}</div>
						{/if}
					{/snippet}
				</Tabs>
			</div>
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
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		/* Out to the bands' edge below, as the tab track (--band-reach). */
		margin: 0 calc(var(--pane-gutter, 0rem) - var(--band-reach)) var(--space-2);
	}
	.game-line > :global(.counts) {
		flex: 1;
		min-width: 0;
	}
	/* --pane-gutter: the pane's side inset, given by where it sits, inside each scroll box. */
	.storyteller-pane :global([data-scope='tabs'][data-part='root'] > :has(> [data-part='list'])) {
		margin-inline: calc(var(--pane-gutter, 0rem) - var(--band-reach));
	}
	.storyteller-pane > :global([data-scope='tabs'][data-part='root']),
	.subject > :global([data-scope='tabs'][data-part='root']) {
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
	.subject {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
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
