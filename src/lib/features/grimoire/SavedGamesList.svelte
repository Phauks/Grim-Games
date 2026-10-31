<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	/**
	 * Continue game's As Storyteller: the games still being played, newest first. With `view="previous"`, the
	 * History page (Trevor, 2026-10-16): ended games, opened read-only to look around
	 * (Trevor, 2026-10-17); the board can reopen one.
	 */
	let {
		view = 'active',
		onCount
	}: {
		view?: 'active' | 'previous';
		/** How many games the list shows (unreadable ones too), for a Clear all in the page header. */
		onCount?: (count: number) => void;
	} = $props();
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SavedGameSummary, UnreadableGame } from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { exportHref } from '#lib/features/history/export-hash.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { gameStore } from '#lib/features/game/session.svelte.ts';
	import { forgetGame } from './forget-game.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import {
		endedGames,
		gameStarts,
		nightUnderway,
		nightViews,
		type EndedGame
	} from './device-notes.ts';
	import { phaseText } from './phase-text.ts';
	import { gamePhase } from '#lib/core/rules/index.ts';
	import { gameModeName } from './game-mode-name.ts';

	// ── Saved games ──
	let all = $state<SavedGameSummary[]>([]);
	let ended = $state<Record<string, EndedGame>>({});
	/** Games still being played; ended ones are in History (Trevor, 2026-10-16). */
	const games = $derived(all.filter((g) => !ended[g.gameId]));
	const past = $derived(
		all
			.filter((g) => ended[g.gameId])
			.sort((a, b) => ended[b.gameId].endedAt - ended[a.gameId].endedAt)
	);
	let unreadable = $state<UnreadableGame[]>([]);
	let loaded = $state(false);
	$effect(() => {
		onCount?.(view === 'active' ? games.length + unreadable.length : past.length);
	});

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
			await forget(deleting);
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
		deleting = undefined;
		await refresh();
	}

	const forget = forgetGame;

	/** Deletes every game this list shows (Trevor, 2026-10-18: clear all on Resume game). */
	export async function clearAll() {
		const ids =
			view === 'active'
				? [...games.map((g) => g.gameId), ...unreadable.map((g) => g.gameId)]
				: past.map((g) => g.gameId);
		try {
			for (const id of ids) await forget(id);
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
		await refresh();
	}

	const winnerText = (id: GameId) =>
		ended[id]?.winner === 'good'
			? 'Good won'
			: ended[id]?.winner === 'evil'
				? 'Evil won'
				: 'Winner not recorded';

	/** Where a game is up to, for the list: the board's phase (gamePhase), so they agree. */
	const stageText = (game: SavedGameSummary) => {
		const phase = gamePhase(game.days, {
			begun: gameStarts.read(game.gameId) !== undefined,
			nightUnderway: nightUnderway(nightViews.read(game.gameId), game.days, !!ended[game.gameId])
		});
		return phase.kind === 'setup' ? 'Setting up' : phaseText(phase);
	};
</script>

<!-- The mode in its own colour after the script's name, as in the board's corner title. -->
{#snippet modeName(gameId: GameId)}{#if gameModeName(gameId)}<span
			class="mode"
			data-testid="game-mode">{` · ${gameModeName(gameId)}`}</span
		>{/if}{/snippet}

<!-- Continue game's As Storyteller heading is SavedGamesSection's; History keeps its own "Games" heading. -->
{#if view === 'active'}<section aria-label="Saved games">
		{#if loaded && games.length === 0 && unreadable.length === 0}
			<p class="none">None</p>
		{/if}
		<ul class="games">
			{#each games as game (game.gameId)}
				<li>
					<a class="open" href={resolve('/grimoire/[gameId]', { gameId: game.gameId })}>
						<!-- An alternative mode is named beside the script (Trevor, 2026-10-18). -->
						<ScriptName name={game.scriptName} logo={game.scriptLogo}
							>{@render modeName(game.gameId)}{#snippet sub()}{stageText(game)} · {game.seatCount} seats
								· {when.format(game.savedAt)}{/snippet}</ScriptName
						>
					</a>
					<DeleteButton
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
						<ScriptName name="Unreadable game"
							>{#snippet sub()}{game.problem === 'too-new'
									? 'Saved by a newer version: refresh to update'
									: 'This save is damaged'}{/snippet}</ScriptName
						>
					</span>
					<DeleteButton
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
{:else}<section aria-labelledby="past-games">
		<h2 id="past-games">Games</h2>
		{#if loaded && past.length === 0}
			<p class="none">None</p>
		{/if}
		<ul class="games">
			{#each past as game (game.gameId)}
				<li>
					<!-- Opens read-only, to look around; Reopen is on the board (Trevor, 2026-10-17). -->
					<a class="open" href={resolve('/grimoire/[gameId]', { gameId: game.gameId })}>
						<ScriptName name={game.scriptName} logo={game.scriptLogo}
							>{@render modeName(game.gameId)}{#snippet sub()}{winnerText(game.gameId)} · {stageText(
									game
								)} · {when.format(ended[game.gameId].endedAt)}{/snippet}</ScriptName
						>
					</a>
					<!-- Export opens the board, so its picture is the board itself (Trevor, 2026-10-26). -->
					<IconButton
						icon="download"
						label={`Export ${game.scriptName ?? 'game'} ended ${when.format(ended[game.gameId].endedAt)}`}
						onclick={() => goto(exportHref(game.gameId))}
					/>
					<DeleteButton
						label={`Delete ${game.scriptName ?? 'game'} ended ${when.format(ended[game.gameId].endedAt)}`}
						onclick={() => {
							deleting = game.gameId;
							deleteOpen = true;
						}}
					/>
				</li>
			{/each}
		</ul>
	</section>{/if}

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
	.open {
		flex: 1;
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		color: inherit;
		text-decoration: none;
	}
	a.open:hover {
		background: var(--surface-selected);
		border-radius: var(--radius-md);
	}
	/* The mode in its own colour, as in the board's corner title. */
	.mode {
		color: var(--accent);
	}
</style>
