<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { setupComplete } from '#lib/core/rules/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import WithSavedGame from '#lib/features/game/WithSavedGame.svelte';
	import { attachRoom } from '#lib/features/room/host.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import { openGamePort } from './open-game-port.ts';

	interface Props {
		gameId: GameId;
		/** The screen's title, shown while the game opens or if it can't, so nothing moves. */
		title: string;
		children: Snippet<[SetupGamePort]>;
		/**
		 * Opens even once the game is set up, for a screen the game itself uses (Special rules,
		 * from Game info: Trevor, 2026-10-23, "seems to do nothing but flash the page").
		 */
		inGame?: boolean;
	}

	let { gameId, title, children, inGame = false }: Props = $props();

	async function prepare(open: OpenGame) {
		// A set-up game's bag and selection are closed: back to its grimoire. Checked only on
		// opening, so finishing the draw here doesn't jump away.
		if (!inGame && open.game && setupComplete(open.game)) {
			await goto(resolve('/grimoire/[gameId]', { gameId }), { replaceState: true });
			return undefined;
		}
		// Phones in the room follow the game (and its script) while setup is open.
		attachRoom(open);
		return openGamePort(open);
	}
</script>

<!-- Opens a saved game for the setup screens (character selection and the draw). -->
<WithSavedGame {gameId} area="setup" {prepare} {children}>
	{#snippet fallback({ kind, message })}
		<Page {title}>
			<p aria-busy={kind === 'loading'} role={kind === 'error' ? 'alert' : undefined}>
				{message}
			</p>
		</Page>
	{/snippet}
</WithSavedGame>
