<script lang="ts">
	import { attachRoom } from '#lib/features/room/host.svelte.ts';
	import { resolve } from '$app/paths';
	import type { GameId } from '#lib/core/model/index.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import WithSavedGame from '#lib/features/game/WithSavedGame.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { drawLock } from '#lib/features/setup/draw-lock.svelte.ts';
	import PinDialog from '#lib/features/setup/PinDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { Grimoire } from './grimoire.svelte.ts';
	import GrimoireBoard from './GrimoireBoard.svelte';
	import PlayersDialog from '#lib/features/room/PlayersDialog.svelte';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	let grimoire = $state<Grimoire>();
	// While this game's draw is locked, players hold the phone: the board stays hidden behind
	// the Storyteller PIN (Trevor, 2026-10-19).
	const locked = $derived(drawLock.isLocked(gameId));
	let pinOpen = $state(false);
	// Badges on the board, night and day name the script's homebrew characters, not their ids.
	provideCharacters(() => grimoire?.open.characters);

	function prepare(open: OpenGame) {
		const board = new Grimoire(open);
		// Phones in this device's live room follow the open game (a no-op without a room), and
		// viewers of the view-only link see this board's seats and reminders where they are.
		attachRoom(open, () => ({
			layout: board.layout,
			reminderSpots: board.reminderSpots,
			copies: [...board.copies]
		}));
		grimoire = board;
		return grimoire;
	}
</script>

<WithSavedGame {gameId} area="grimoire" {prepare}>
	{#snippet children(board: Grimoire)}
		{#if locked}
			<main class="message locked" data-testid="board-locked">
				<h1>{t('setup.lock.boardTitle')}</h1>
				<p>{t('setup.lock.boardBody')}</p>
				<div class="actions">
					<Button href={resolve('/grimoire/[gameId]/draw', { gameId })} icon="back"
						>{t('setup.lock.backToDraw')}</Button
					>
					<Button variant="accent" icon="lock" onclick={() => (pinOpen = true)}
						>{t('setup.lock.unlock')}</Button
					>
				</div>
			</main>
			<PinDialog bind:open={pinOpen} {gameId} />
		{:else}
			<ErrorBoundary area="grimoire">
				<GrimoireBoard grimoire={board} />
				<!-- Players, their notes, messages and reported pictures, from ⋯ (Trevor, 2026-10-29). -->
				<PlayersDialog game={board.open} run={(command) => board.run(command)} />
			</ErrorBoundary>
		{/if}
	{/snippet}
	{#snippet fallback({ kind, message })}
		<main class="message">
			<p role={kind === 'error' ? 'alert' : undefined}>{message}</p>
			{#if kind !== 'loading'}
				<Button href={resolve('/')} icon="back">Saved games</Button>
			{/if}
		</main>
	{/snippet}
</WithSavedGame>

<style>
	.message {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.locked {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		text-align: center;
	}
	.locked h1 {
		margin: 0;
	}
	.locked p {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
</style>
