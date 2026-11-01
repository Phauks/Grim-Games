<script lang="ts">
	import Spinner from '#lib/ui/primitives/Spinner.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import type { GameId } from '#lib/core/model/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import WithSavedGame from '#lib/features/game/WithSavedGame.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { prepareRoom } from './host.svelte.ts';
	import PlayersPanel from './PlayersPanel.svelte';
	import RoomPanel from './RoomPanel.svelte';

	interface Props {
		gameId: GameId;
		/** Players (Trevor, 2026-10-29) rather than Share: the same page, its own panel. */
		players?: boolean;
	}

	let { gameId, players = false }: Props = $props();

	// The room opens while the game loads, not after; Players needs no room (its notes).
	// The page is keyed by game and never switches between Share and Players.
	if (!untrack(() => players)) prepareRoom();
</script>

<main class:fill={players}>
	<header>
		<Button
			href={resolve('/grimoire/[gameId]', { gameId })}
			icon="back"
			variant="quiet"
			data-way-back
		>
			{t('room.back')}
		</Button>
		<h1>{players ? t('room.players.title') : t('room.title')}</h1>
	</header>
	<WithSavedGame {gameId} area="grimoire">
		{#snippet children(game: OpenGame)}
			{#if players}<PlayersPanel {game} />{:else}<RoomPanel {game} />{/if}
		{/snippet}
		{#snippet fallback({ kind, message })}
			<p
				class="message"
				aria-busy={kind === 'loading'}
				role={kind === 'error' ? 'alert' : undefined}
			>
				{#if kind === 'loading'}<Spinner />{/if}
				{message}
			</p>
		{/snippet}
	</WithSavedGame>
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-4) var(--page-gutter);
	}
	/* Players fills the screen: its list and its chosen player each scroll on their own. */
	main.fill {
		grid-template-rows: auto minmax(0, 1fr);
		height: 100dvh;
		box-sizing: border-box;
	}
	main > :global(*) {
		min-width: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	.message {
		min-height: 60dvh;
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
