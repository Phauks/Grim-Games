<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import type { GameId } from '#lib/core/model/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import WithSavedGame from '#lib/features/game/WithSavedGame.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { prepareRoom } from './host.svelte.ts';
	import RoomPanel from './RoomPanel.svelte';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	// The room opens while the game loads, not after.
	prepareRoom();
</script>

<main>
	<header>
		<Button
			href={resolve('/grimoire/[gameId]', { gameId })}
			icon="back"
			variant="quiet"
			data-way-back
		>
			{t('room.back')}
		</Button>
		<h1>{t('room.title')}</h1>
	</header>
	<WithSavedGame {gameId} area="grimoire">
		{#snippet children(game: OpenGame)}
			<RoomPanel {game} />
		{/snippet}
		{#snippet fallback({ kind, message })}
			<p
				class="message"
				aria-busy={kind === 'loading'}
				role={kind === 'error' ? 'alert' : undefined}
			>
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
