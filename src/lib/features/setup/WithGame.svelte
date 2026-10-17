<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	import { attachRoom } from '#lib/features/room/host.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import { openGamePort } from './open-game-port.ts';

	interface Props {
		gameId: GameId;
		/** The screen's title, shown while the game opens or if it can't, so nothing moves. */
		title: string;
		children: Snippet<[SetupGamePort]>;
	}

	let { gameId, title, children }: Props = $props();

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
				// Phones in the room follow the game (and its script) while setup is open.
				if (open) attachRoom(open);
				view = open ? { kind: 'ready', port: openGamePort(open) } : { kind: 'missing' };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area: 'setup', notify: false });
				view = {
					kind: 'error',
					message:
						e instanceof SavedGameError && e.problem === 'too-new'
							? t('setup.open.tooNew')
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
	<Page {title}>
		{#if view.kind === 'loading'}
			<p aria-busy="true">{t('setup.open.loading')}</p>
		{:else if view.kind === 'missing'}
			<p>{t('setup.open.missing')}</p>
		{:else}
			<p role="alert">{view.message}</p>
		{/if}
	</Page>
{/if}
