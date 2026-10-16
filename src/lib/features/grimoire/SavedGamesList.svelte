<script lang="ts">
	/** Resume game (its own screen, Trevor 2026-10-16): every saved game, newest first. */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { SavedGameSummary, UnreadableGame } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { gameStore } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { seatLayouts } from './device-notes.ts';

	// ── Saved games ──
	let games = $state<SavedGameSummary[]>([]);
	let unreadable = $state<UnreadableGame[]>([]);
	let loaded = $state(false);

	async function refresh() {
		try {
			({ games, unreadable } = await gameStore().list());
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
		loaded = true;
	}
	onMount(() => void refresh());

	const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

	let deleting = $state<GameId | undefined>();
	let deleteOpen = $state(false);
	async function confirmDelete() {
		deleteOpen = false;
		if (!deleting) return;
		try {
			await gameStore().delete(deleting);
			seatLayouts.forget(deleting);
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
		deleting = undefined;
		await refresh();
	}

	/** Where a game is up to, for the list. */
	const stageText = (game: SavedGameSummary) =>
		game.stage.kind === 'setup' ? 'Setting up' : `Day ${game.stage.day}`;
</script>

<section aria-labelledby="saved-games">
	<h2 id="saved-games">Resume game</h2>
	{#if loaded && games.length === 0 && unreadable.length === 0}
		<p class="none">None</p>
	{/if}
	<ul class="games">
		{#each games as game (game.gameId)}
			<li>
				<a class="open" href={resolve('/grimoire/[gameId]', { gameId: game.gameId })}>
					<span class="name">{game.scriptName ?? 'Custom script'}</span>
					<span class="meta"
						>{stageText(game)} · {game.seatCount} seats · {when.format(game.savedAt)}</span
					>
				</a>
				<IconButton
					icon="remove"
					label={`Delete ${game.scriptName ?? 'game'} saved ${when.format(game.savedAt)}`}
					onclick={() => {
						deleting = game.gameId;
						deleteOpen = true;
					}}
				/>
			</li>
		{/each}
		{#each unreadable as game (game.gameId)}
			<li>
				<span class="open" aria-disabled="true">
					<span class="name">Unreadable game</span>
					<span class="meta"
						>{game.problem === 'too-new'
							? 'Saved by a newer version: refresh to update'
							: 'This save is damaged'}</span
					>
				</span>
				<IconButton
					icon="remove"
					label="Delete unreadable game"
					onclick={() => {
						deleting = game.gameId;
						deleteOpen = true;
					}}
				/>
			</li>
		{/each}
	</ul>
</section>

<Dialog bind:open={deleteOpen} title="Delete this game?" role="alertdialog">
	<p>It is removed from this device and cannot be brought back.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (deleteOpen = false)}>Cancel</Button>
		<Button variant="accent" icon="remove" onclick={confirmDelete}>Delete</Button>
	{/snippet}
</Dialog>

<style>
	section {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	h2 {
		margin: 0;
		font-size: 1.3rem;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.games {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.games li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.open {
		flex: 1;
		display: grid;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		color: inherit;
		text-decoration: none;
	}
	a.open:hover {
		background: var(--surface-selected);
		border-radius: var(--radius-md);
	}
	.name {
		font-family: var(--font-heading);
		color: var(--heading);
	}
	.meta {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>
