<script lang="ts">
	import { attachRoom } from '#lib/features/room/host.svelte.ts';
	import { resolve } from '$app/paths';
	import type { GameId } from '#lib/core/model/index.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import WithSavedGame from '#lib/features/game/WithSavedGame.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { Grimoire } from './grimoire.svelte.ts';
	import GrimoireBoard from './GrimoireBoard.svelte';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	let grimoire = $state<Grimoire>();
	// Badges on the board, night and day name the script's homebrew characters, not their ids.
	provideCharacters(() => grimoire?.open.characters);

	function prepare(open: OpenGame) {
		// Phones in this device's live room follow the open game (a no-op without a room).
		attachRoom(open);
		grimoire = new Grimoire(open);
		return grimoire;
	}
</script>

<WithSavedGame {gameId} area="grimoire" {prepare}>
	{#snippet children(board: Grimoire)}
		<ErrorBoundary area="grimoire">
			<GrimoireBoard grimoire={board} />
		</ErrorBoundary>
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
</style>
