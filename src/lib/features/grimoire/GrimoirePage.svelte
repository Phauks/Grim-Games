<script lang="ts">
	import { attachRoom } from '#lib/features/room/host.svelte.ts';
	import { resolve } from '$app/paths';
	import { SavedGameError } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { Grimoire } from './grimoire.svelte.ts';
	import GrimoireBoard from './GrimoireBoard.svelte';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'ready'; grimoire: Grimoire }
		| { kind: 'missing' }
		| { kind: 'error'; message: string };

	let view = $state<State>({ kind: 'loading' });
	// Badges on the board, night and day name the script's homebrew characters, not their ids.
	provideCharacters(() => (view.kind === 'ready' ? view.grimoire.open.characters : undefined));

	$effect(() => {
		const id = gameId;
		view = { kind: 'loading' };
		let cancelled = false;
		(async () => {
			try {
				const data = await loadOfficialData();
				const open = await OpenGame.open(data, id);
				if (cancelled) return;
				// Phones in this device's live room follow the open game (a no-op without a room).
				if (open) attachRoom(open);
				view = open ? { kind: 'ready', grimoire: new Grimoire(open) } : { kind: 'missing' };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area: 'grimoire', notify: false });
				const message =
					e instanceof SavedGameError && e.problem === 'too-new'
						? 'This game was saved by a newer version of Grim-Games. Refresh to update, then open it again.'
						: errorMessage(e);
				view = { kind: 'error', message };
			}
		})();
		return () => (cancelled = true);
	});
</script>

{#if view.kind === 'ready'}
	<ErrorBoundary area="grimoire">
		<GrimoireBoard grimoire={view.grimoire} />
	</ErrorBoundary>
{:else}
	<main class="message">
		{#if view.kind === 'loading'}
			<p>Opening the game…</p>
		{:else if view.kind === 'missing'}
			<p>There is no saved game here on this device.</p>
			<Button href={resolve('/')} icon="back">Saved games</Button>
		{:else}
			<p role="alert">{view.message}</p>
			<Button href={resolve('/')} icon="back">Saved games</Button>
		{/if}
	</main>
{/if}

<style>
	.message {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
</style>
