<script lang="ts">
	import { resolve } from '$app/paths';
	import { SavedGameError } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import RoomPanel from './RoomPanel.svelte';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	type View =
		| { kind: 'loading' }
		| { kind: 'ready'; game: OpenGame }
		| { kind: 'missing' }
		| { kind: 'error'; message: string };

	let view = $state<View>({ kind: 'loading' });

	$effect(() => {
		const id = gameId;
		view = { kind: 'loading' };
		let cancelled = false;
		(async () => {
			try {
				const open = await OpenGame.open(await loadOfficialData(), id);
				if (cancelled) return;
				view = open ? { kind: 'ready', game: open } : { kind: 'missing' };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area: 'grimoire', notify: false });
				view = {
					kind: 'error',
					message:
						e instanceof SavedGameError && e.problem === 'too-new'
							? 'This game was saved by a newer version of Grim-Games. Refresh to update, then open it again.'
							: errorMessage(e)
				};
			}
		})();
		return () => (cancelled = true);
	});
</script>

<main>
	<header>
		<Button href={resolve('/grimoire/[gameId]', { gameId })} icon="back" variant="quiet">
			Grimoire
		</Button>
		<h1>Players' phones</h1>
	</header>
	{#if view.kind === 'ready'}
		<RoomPanel game={view.game} />
	{:else if view.kind === 'loading'}
		<p class="message" aria-busy="true">Opening the game…</p>
	{:else if view.kind === 'missing'}
		<p class="message">There is no saved game here on this device.</p>
	{:else}
		<p class="message" role="alert">{view.message}</p>
	{/if}
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		max-width: calc(72 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
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
