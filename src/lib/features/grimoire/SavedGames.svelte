<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		editionScript,
		OFFICIAL_EDITIONS,
		toScript,
		type OfficialEditionId
	} from '#lib/core/data/index.ts';
	import {
		MAX_PLAYERS,
		MIN_PLAYERS,
		type SavedGameSummary,
		type UnreadableGame
	} from '#lib/core/engine/index.ts';
	import type { GameId } from '#lib/core/model/index.ts';
	import { recentScripts, restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { gameStore, OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';
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
	onMount(() => {
		void refresh();
		void restoreScripts();
	});

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

	// ── New game ──
	/** An official edition, or `recent:<scriptId>` for a script from the Scripts page. */
	type ScriptChoice = OfficialEditionId | `recent:${string}`;
	let edition = $state<ScriptChoice>('tb');
	/** The editions, then up to three recent custom scripts, most recently used first. */
	const scriptOptions = $derived([
		...OFFICIAL_EDITIONS.map((e) => ({ value: e.id as ScriptChoice, label: e.name })),
		...recentScripts.list
			.filter((s) => !s.edition)
			.slice(0, 3)
			.map((s) => ({ value: `recent:${s.scriptId}` as ScriptChoice, label: s.name }))
	]);
	let players = $state(8);
	let starting = $state(false);

	async function start() {
		starting = true;
		try {
			const data = await loadOfficialData();
			const choice = edition;
			const recent = choice.startsWith('recent:')
				? recentScripts.list.find((s) => `recent:${s.scriptId}` === choice)
				: undefined;
			const loaded = recent ? reloadSavedScript(recent, data) : editionScript(choice, data);
			if (!loaded) throw new Error('the chosen script could not be loaded');
			const open = await OpenGame.create(data, toScript(loaded), players);
			await goto(resolve('/grimoire/[gameId]', { gameId: open.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<section aria-labelledby="new-game">
	<h2 id="new-game">New game</h2>
	<ChoiceGroup
		label="Script"
		value={edition}
		options={scriptOptions}
		onChange={(v) => (edition = v)}
	/>
	<div class="players">
		<span class="label" id="players-label">Players</span>
		<IconButton
			icon="back"
			label="Fewer players"
			disabled={players <= MIN_PLAYERS}
			onclick={() => (players = Math.max(MIN_PLAYERS, players - 1))}
		/>
		<output aria-labelledby="players-label">{players}</output>
		<IconButton
			icon="forward"
			label="More players"
			disabled={players >= MAX_PLAYERS}
			onclick={() => (players = Math.min(MAX_PLAYERS, players + 1))}
		/>
	</div>
	<SetupTable {players} />
	<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}>Start game</Button>
</section>

<section aria-labelledby="saved-games">
	<h2 id="saved-games">Saved games</h2>
	{#if loaded && games.length === 0 && unreadable.length === 0}
		<p class="none">None</p>
	{/if}
	<ul class="games">
		{#each games as game (game.gameId)}
			<li>
				<a class="open" href={resolve('/grimoire/[gameId]', { gameId: game.gameId })}>
					<span class="name">{game.scriptName ?? 'Custom script'}</span>
					<span class="meta">{game.seatCount} seats · {when.format(game.savedAt)}</span>
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
	.players {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.label {
		flex: 1;
		font-family: var(--font-control);
	}
	output {
		min-width: 2ch;
		font: 600 1.3rem / 1 var(--font-control);
		text-align: center;
		font-variant-numeric: tabular-nums;
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
