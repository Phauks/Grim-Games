<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SavedGameError } from '#lib/core/engine/index.ts';
	import { setupComplete } from '#lib/core/rules/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import { openGamePort } from './open-game-port.ts';

	interface Props {
		gameId: GameId;
		children: Snippet<[SetupGamePort]>;
	}

	let { gameId, children }: Props = $props();

	type View =
		| { kind: 'loading' }
		| { kind: 'ready'; port: SetupGamePort }
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
				// A set-up game's bag and selection are closed: back to its grimoire. Checked only
				// on opening, so finishing the draw here doesn't jump away.
				if (open?.game && setupComplete(open.game)) {
					await goto(resolve('/grimoire/[gameId]', { gameId: id }), { replaceState: true });
					return;
				}
				view = open ? { kind: 'ready', port: openGamePort(open) } : { kind: 'missing' };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area: 'setup', notify: false });
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

<!-- Opens a saved game for the setup screens (character selection and the draw). -->
{#if view.kind === 'ready'}
	{@render children(view.port)}
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
