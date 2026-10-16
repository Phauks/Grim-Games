<script lang="ts">
	import { resolve } from '$app/paths';
	import { SavedGameError } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DayPanel from './DayPanel.svelte';
	import { LiveDay } from './live-day.svelte.ts';

	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	type View =
		| { kind: 'loading' }
		| { kind: 'ready'; day: LiveDay }
		| { kind: 'missing' }
		| { kind: 'error'; message: string };

	let view = $state<View>({ kind: 'loading' });
	const assistance = $derived(preferences.current.assistance);

	$effect(() => {
		const id = gameId;
		view = { kind: 'loading' };
		let cancelled = false;
		(async () => {
			try {
				const open = await OpenGame.open(await loadOfficialData(), id);
				if (cancelled) return;
				view = open ? { kind: 'ready', day: new LiveDay(open) } : { kind: 'missing' };
			} catch (e) {
				if (cancelled) return;
				reportError(e, { area: 'day', notify: false });
				view = {
					kind: 'error',
					message:
						e instanceof SavedGameError && e.problem === 'too-new'
							? t('day.tooNew')
							: errorMessage(e)
				};
			}
		})();
		return () => (cancelled = true);
	});
</script>

<!--
	The Storyteller's day: nominations, executions and exiles, deaths with an optional cause,
	ability uses and notes, logged by hand (no voter lists). Everything works without the app's
	suggestions; "New day" clears the log.
-->
<main>
	<header>
		<Button href={resolve('/grimoire/[gameId]', { gameId })} icon="back" variant="quiet">
			{t('day.backToGrimoire')}
		</Button>
		<h1>{t('day.title')}</h1>
	</header>
	{#if view.kind === 'ready'}
		<DayPanel game={view.day} {assistance} />
	{:else if view.kind === 'loading'}
		<!-- Reserved space while the game opens, so nothing below jumps. -->
		<p class="message" aria-busy="true">{t('day.opening')}</p>
	{:else if view.kind === 'missing'}
		<p class="message">{t('day.noSavedGame')}</p>
	{:else}
		<p class="message" role="alert">{view.message}</p>
	{/if}
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		max-width: calc(48 * var(--u));
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
