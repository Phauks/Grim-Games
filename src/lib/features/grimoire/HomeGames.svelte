<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { SavedGameSummary } from '#lib/core/engine/index.ts';
	import { gameStore } from '#lib/features/game/session.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { endedGames } from './device-notes.ts';

	/**
	 * The home page's way into games (Trevor, 2026-10-16): New game and Resume game are
	 * screens of their own, and the most recent game is one tap away.
	 */
	let latest = $state<SavedGameSummary | undefined>();
	onMount(async () => {
		try {
			const { games } = await gameStore().list();
			// An ended game is in Past games, not Continue (Trevor, 2026-10-16).
			const ended = endedGames.read();
			latest = games.find((g) => !ended[g.gameId]);
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	});
	const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	const stageText = (game: SavedGameSummary) =>
		game.stage.kind === 'setup' ? 'Setting up' : `Day ${game.stage.day}`;
</script>

<section aria-label="Games">
	<!-- Always the same height: "None" holds the place until a game is saved. -->
	<div class="latest">
		<span class="caption">Continue</span>
		{#if latest}
			<a class="game" href={resolve('/grimoire/[gameId]', { gameId: latest.gameId })}>
				<span class="name">{latest.scriptName || 'None'}</span>
				<span class="meta"
					>{stageText(latest)} · {latest.seatCount} seats · {when.format(latest.savedAt)}</span
				>
			</a>
		{:else}
			<span class="game none">None</span>
		{/if}
	</div>
	<div class="entries">
		<Button variant="accent" icon="grimoire" href={resolve('/new')}>New game</Button>
		<Button icon="history" href={resolve('/games')}>Resume game</Button>
	</div>
</section>

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	.latest {
		display: grid;
		min-width: 0;
		gap: var(--space-1);
	}
	.caption {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.game {
		display: grid;
		min-height: calc(var(--tap-target) + var(--space-3));
		align-content: center;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	a.game:hover {
		background: var(--surface-selected);
	}
	.none {
		color: var(--on-surface-muted);
	}
	.name,
	.meta {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.name {
		font-family: var(--font-heading);
		color: var(--heading);
	}
	.meta {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	/* Side by side when they fit; stacked on a narrow phone at a large text size. */
	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
		gap: var(--space-2);
	}
</style>
