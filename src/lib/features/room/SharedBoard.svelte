<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { migrateSavedGame, SavedGameError } from '#lib/core/engine/index.ts';
	import type { SharedGrimoire } from '#lib/core/sync/room.ts';
	import { parsePublicLook } from '#lib/core/sync/public-projection.ts';
	import { dayTimers } from '#lib/core/rules/index.ts';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { WatchedTimer } from '#lib/features/day/watched-timer.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import {
		parseReminderCopyIds,
		parseReminderSpots,
		type EndedGame
	} from '#lib/features/grimoire/device-notes.ts';
	import { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import GrimoireBoard from '#lib/features/grimoire/GrimoireBoard.svelte';
	import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';
	import { lookForNewerBuild } from './newer-build.ts';

	/**
	 * The Storyteller's grimoire as another device sent it, drawn view-only: the view-only
	 * link (Specters) and the finished grimoire shared with players after the game (Share
	 * grim, plan R5). Each new grimoire is checked as a saved game before it shows.
	 */
	interface Props {
		shared: SharedGrimoire | undefined;
		/** Told whether a grimoire is drawn. */
		onReady?: (ready: boolean) => void;
		/** Told why the grimoire can't be shown, or `undefined` once it can. */
		onProblem?: (problem: string | undefined) => void;
		/** The room says the game is over: its History can be stepped through here. */
		over?: EndedGame;
		/** The room it came through, which holds the board's background picture. */
		room?: string;
		/** History can be looked through while the game goes on (an admin's Live games). */
		history?: boolean;
	}

	let { shared, onReady, onProblem, over, room, history = false }: Props = $props();

	let board = $state.raw<Grimoire>();
	/** The Storyteller's day timer, as sent with the grimoire. */
	const timer = new WatchedTimer();
	$effect(() => () => timer.stop());

	provideCharacters(() => board?.open.characters);

	$effect(() => {
		if (shared) void show(shared);
	});
	$effect(() => {
		onReady?.(!!board);
	});

	async function show(next: SharedGrimoire) {
		try {
			const saved = migrateSavedGame(next.saved);
			const data = await loadOfficialData();
			if (shared !== next) return;
			let drawn = board;
			if (!drawn || drawn.game.gameId !== saved.gameId || !drawn.open.follow(saved)) {
				drawn = new Grimoire(OpenGame.watch(data, saved));
			}
			drawn.layout = parseSeatLayout(next.layout);
			drawn.reminderSpots = parseReminderSpots(next.reminderSpots);
			drawn.copies = parseReminderCopyIds(next.copies);
			drawn.look = parsePublicLook(next.look);
			drawn.room = room;
			timer.set(dayTimers.parseSharedTimer(next.timer));
			board = drawn;
			onProblem?.(undefined);
		} catch (e) {
			const tooNew = e instanceof SavedGameError && e.problem === 'too-new';
			// The Storyteller's app is newer: offer its build rather than a dead end.
			if (tooNew) lookForNewerBuild();
			onProblem?.(tooNew ? t('room.grimoireTooNew') : errorMessage(e));
		}
	}
</script>

{#if board}
	<ErrorBoundary area="grimoire">
		<GrimoireBoard
			grimoire={board}
			watching
			watchedTimer={timer.known ? timer : undefined}
			{over}
			watchedHistory={history}
		/>
	</ErrorBoundary>
{/if}
