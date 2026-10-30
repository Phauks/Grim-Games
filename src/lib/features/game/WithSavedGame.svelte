<script lang="ts" module>
	export type SavedGameStatus = {
		kind: 'loading' | 'missing' | 'error';
		/** What to say, ready to show. */
		message: string;
	};
</script>

<script lang="ts" generics="T">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Snippet } from 'svelte';
	import { SavedGameError } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { offerGameToReports } from '#lib/features/reports/report-game.svelte.ts';
	import { OpenGame } from './session.svelte.ts';

	/**
	 * Opens a game saved on this device for a screen (component review, 2026-10-18: the
	 * grimoire, the setup screens and Players' phones each opened it their own way). The
	 * screen keeps its own frame; this says what to show in it until the game is open.
	 */
	interface Props {
		gameId: GameId;
		/** Where an error opening the game is reported from. */
		area: string;
		/**
		 * Turns the open game into what the screen needs. Nothing back means the screen went
		 * elsewhere (a set-up game's draw goes back to its grimoire), so it stays loading.
		 */
		prepare?: (open: OpenGame) => T | undefined | Promise<T | undefined>;
		children: Snippet<[T]>;
		/** Shown while the game opens, if there's none, or if it can't be opened. */
		fallback: Snippet<[SavedGameStatus]>;
	}

	let { gameId, area, prepare = (open) => open as T, children, fallback }: Props = $props();

	type View = SavedGameStatus | { kind: 'ready'; value: T };

	const loading = (): View => ({ kind: 'loading', message: t('common.gameOpening') });
	let view = $state<View>(loading());
	/** The game once open: a report sent from any of its screens may carry it (Trevor, 2026-10-30). */
	let opened = $state.raw<OpenGame>();
	offerGameToReports(() => opened);

	$effect(() => {
		const id = gameId;
		view = loading();
		opened = undefined;
		let cancelled = false;
		(async () => {
			try {
				const open = await OpenGame.open(await loadOfficialData(), id);
				if (cancelled) return;
				if (!open) {
					view = { kind: 'missing', message: t('common.gameMissing') };
					return;
				}
				opened = open;
				const value = await prepare(open);
				if (cancelled || value === undefined) return;
				view = { kind: 'ready', value };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area, notify: false });
				view = {
					kind: 'error',
					message:
						e instanceof SavedGameError && e.problem === 'too-new'
							? t('common.gameTooNew')
							: errorMessage(e)
				};
			}
		})();
		return () => (cancelled = true);
	});
</script>

{#if view.kind === 'ready'}
	{@render children(view.value)}
{:else}
	{@render fallback(view)}
{/if}
