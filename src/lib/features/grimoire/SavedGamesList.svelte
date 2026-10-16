<script lang="ts">
	/** Resume game (its own screen, Trevor 2026-10-16): every saved game, newest first. */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { SavedGameSummary, UnreadableGame } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { gameStore } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { endedGames, seatLayouts, type EndedGame } from './device-notes.ts';
	import { goto } from '$app/navigation';

	// ── Saved games ──
	let all = $state<SavedGameSummary[]>([]);
	let ended = $state<Record<string, EndedGame>>({});
	/** Games still being played; ended ones are listed under Past games (Trevor, 2026-10-16). */
	const games = $derived(all.filter((g) => !ended[g.gameId]));
	const past = $derived(
		all
			.filter((g) => ended[g.gameId])
			.sort((a, b) => ended[b.gameId].endedAt - ended[a.gameId].endedAt)
	);
	let unreadable = $state<UnreadableGame[]>([]);
	let loaded = $state(false);

	async function refresh() {
		try {
			({ games: all, unreadable } = await gameStore().list());
			ended = endedGames.read();
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
			endedGames.reopen(deleting);
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
		deleting = undefined;
		await refresh();
	}

	// ── Past games: reopening one puts it back in Resume game ──
	let reopening = $state<SavedGameSummary | undefined>();
	let reopenOpen = $state(false);
	function reopen() {
		reopenOpen = false;
		if (!reopening) return;
		endedGames.reopen(reopening.gameId);
		void goto(resolve('/grimoire/[gameId]', { gameId: reopening.gameId }));
	}
	const winnerText = (id: GameId) =>
		ended[id]?.winner === 'good'
			? 'Good won'
			: ended[id]?.winner === 'evil'
				? 'Evil won'
				: 'Winner not recorded';

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
					<span class="name">{game.scriptName || 'None'}</span>
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

<section aria-labelledby="past-games">
	<h2 id="past-games">Past games</h2>
	{#if loaded && past.length === 0}
		<p class="none">None</p>
	{/if}
	<ul class="games">
		{#each past as game (game.gameId)}
			<li>
				<button
					type="button"
					class="open"
					onclick={() => {
						reopening = game;
						reopenOpen = true;
					}}
				>
					<span class="name">{game.scriptName || 'None'}</span>
					<span class="meta"
						>{winnerText(game.gameId)} · {stageText(game)} · {when.format(
							ended[game.gameId].endedAt
						)}</span
					>
				</button>
				<IconButton
					icon="remove"
					label={`Delete ${game.scriptName ?? 'game'} ended ${when.format(ended[game.gameId].endedAt)}`}
					onclick={() => {
						deleting = game.gameId;
						deleteOpen = true;
					}}
				/>
			</li>
		{/each}
	</ul>
</section>

<ConfirmDialog bind:open={reopenOpen} title="Reopen this game?" onConfirm={reopen}>
	{#if reopening}
		<dl class="change">
			<dt>Now</dt>
			<dd>{reopening.scriptName || 'None'} in Past games</dd>
			<dt>Becomes</dt>
			<dd>Back in Resume game, open in the grimoire</dd>
		</dl>
	{/if}
</ConfirmDialog>

<ConfirmDialog bind:open={deleteOpen} title="Delete this game?" danger onConfirm={confirmDelete}>
	<p>It is removed from this device and cannot be brought back.</p>
</ConfirmDialog>

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
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	button.open {
		border: 0;
		background: none;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	button.open:hover {
		background: var(--surface-selected);
		border-radius: var(--radius-md);
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
