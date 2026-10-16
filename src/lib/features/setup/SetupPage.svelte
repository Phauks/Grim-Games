<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		fromScript,
		type Character,
		type CharacterId,
		type CharacterType
	} from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import {
		analyseSelection,
		canDuplicate,
		jinxSetupWarnings,
		planBag,
		randomSelection,
		scriptJinxes,
		selectedIds,
		isRuleCharacter
	} from '#lib/core/rules/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterSearchBox from '#lib/features/characters/CharacterSearchBox.svelte';
	import CharacterChoice from './CharacterChoice.svelte';
	import CountsBar from './CountsBar.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import SetupCheckDialog from './SetupCheckDialog.svelte';
	import SetupTable from './SetupTable.svelte';
	import { buildErrors } from './build-check.ts';
	import { MAX_SELECT_PLAYERS, MIN_SELECT_PLAYERS, setupSelection } from './selection.svelte.ts';

	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	let checkOpen = $state(false);
	let replaceOpen = $state(false);
	let errorsOpen = $state(false);
	let query = $state('');

	onMount(() => void loadOfficialData());

	const game = $derived(port.game);
	const data = $derived(officialData.current);
	// The game's own script, so a homebrew character is found even if the Scripts page moved on.
	const script = $derived(game && data ? fromScript(game.script, data).script : undefined);
	$effect(() => {
		if (game) setupSelection.open(game.gameId, game.seating.length);
	});
	const s = $derived(setupSelection.state);

	const lookup = (id: CharacterId): Character | undefined => port.lookup?.get(id);
	const findByName = (name: string) =>
		[...(port.lookup?.values() ?? [])].find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;

	// Fabled and Loric are rule characters: the grimoire adds them, the bag never holds them.
	const choices = $derived(script?.characters.filter((c) => !isRuleCharacter(c.type)) ?? []);
	const scriptOrder = $derived(choices.map((c) => c.id));
	const TYPES: CharacterType[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];

	const ready = $derived(script !== undefined && game !== undefined && s.gameId === game.gameId);
	const analysis = $derived(
		analyseSelection({
			players: s.players,
			selection: s.selection,
			ruleCharacters: game?.ruleCharacters,
			scriptOrder,
			lookup,
			findByName
		})
	);
	const plan = $derived(
		planBag({
			selection: s.selection,
			scriptCharacters: choices,
			lookup,
			standIns: s.standIns,
			random: Math.random
		})
	);
	// Keep a suggested stand-in once made, so the Drunk's Townsfolk doesn't change on every tap.
	$effect(() => {
		if (!ready) return;
		for (const standIn of plan.standIns) {
			if (!standIn.chosen && standIn.shows)
				setupSelection.setStandIn(standIn.characterId, standIn.shows);
		}
	});
	const ids = $derived(selectedIds(s.selection, scriptOrder));
	const jinxes = $derived(
		data && script ? scriptJinxes(data.jinxes, ids, script.homebrewJinxes) : []
	);
	const jinxed = $derived(new Set(jinxes.flatMap((j) => j.characters)));
	const travellers = $derived(ids.filter((id) => lookup(id)?.type === 'traveller').length);
	const warnings = $derived([
		...analysis.warnings.map((w) => w.message),
		...plan.issues.map((i) => i.message),
		...jinxSetupWarnings(jinxes, ids, (id) => lookup(id)?.name ?? id).map((w) => w.message)
	]);

	const errors = $derived(buildErrors({ analysis, issues: plan.issues, travellers }));

	// Copies only where a character's rules allow them (Village Idiot, Legion, or with the
	// Pope or Atheist in play), never through a general switch (Trevor, 2026-10-15).
	const inPlay = $derived(
		[...ids, ...(game?.ruleCharacters ?? [])]
			.map((id) => lookup(id))
			.filter((c): c is Character => c !== undefined)
	);

	function toggle(character: Character) {
		const n = setupSelection.copies(character.id);
		setupSelection.setCopies(character.id, n === 0 ? 1 : n - 1);
	}

	/** True once any tile of the current bag was drawn: rebuilding would put them back. */
	const drawStarted = $derived(
		Object.values(game?.bag?.tiles ?? {}).some((t) => t.drawnBySeat !== undefined)
	);

	function send(command: Command): boolean {
		const result = port.dispatch(command);
		if (!result.ok) toast("Couldn't do that", result.error.message);
		return result.ok;
	}

	/**
	 * Build bag: errors are confirmed first (never by accident, but the Storyteller can
	 * still build anyway), then replacing a bag that is being drawn from.
	 */
	function requestBuild(confirmedErrors = false) {
		errorsOpen = false;
		if (!confirmedErrors && errors.length > 0) errorsOpen = true;
		else if (drawStarted) replaceOpen = true;
		else void buildBag();
	}

	/** Adds seats for extra players (never removes any), builds the bag and opens the draw. */
	async function buildBag() {
		replaceOpen = false;
		if (!game) return;
		for (let n = port.game?.seating.length ?? 0; n < s.players; n++) {
			if (!send({ type: 'AddSeat' })) return;
		}
		if (!send({ type: 'BuildBag', tiles: plan.tiles, includeTravellers: plan.includeTravellers }))
			return;
		await port.flush();
		await goto(resolve('/grimoire/[gameId]/draw', { gameId: game.gameId }));
	}

	function random() {
		setupSelection.replace(
			randomSelection({
				players: s.players,
				// A fresh draw on every tap (Trevor, 2026-10-16), not a top-up of the current one.
				selection: {},
				scriptCharacters: choices,
				scriptOrder,
				lookup,
				findByName,
				random: Math.random
			})
		);
	}
</script>

<main>
	<header class="top">
		<h1>Characters</h1>
		<p class="script">
			<span class="label">Script</span>
			<span class="name" data-testid="setup-script-name">{script?.name ?? 'None'}</span>
		</p>
	</header>

	<ErrorBoundary area="setup">
		<section class="controls" aria-label="Players">
			<div class="players">
				<span id="players-label">Players</span>
				<button
					type="button"
					class="step"
					aria-label="Fewer players"
					disabled={s.players <= MIN_SELECT_PLAYERS}
					onclick={() => setupSelection.setPlayers(s.players - 1)}>−</button
				>
				<output aria-labelledby="players-label" data-testid="player-count">{s.players}</output>
				<button
					type="button"
					class="step"
					aria-label="More players"
					disabled={s.players >= MAX_SELECT_PLAYERS}
					onclick={() => setupSelection.setPlayers(s.players + 1)}>+</button
				>
			</div>
			<Collapsible title="Setup sheet" storageKey="setup:sheet">
				<SetupTable players={s.players} />
			</Collapsible>
		</section>
		<div class="counts">
			<CountsBar {analysis} {travellers} />
			<CharacterSearchBox bind:query />
		</div>

		<CharacterPicker
			characters={choices}
			mode="multi"
			selected={ids}
			bind:query
			showSearch={false}
			collapsibleKey="setup"
			contained={false}
			types={TYPES}
			onSelect={(id) => {
				const character = lookup(id);
				if (character) toggle(character);
			}}
		>
			{#snippet item(character)}
				<CharacterChoice
					{character}
					copies={s.selection[character.id] ?? 0}
					duplicates={canDuplicate(character, inPlay)}
					jinxed={jinxed.has(character.id)}
					onToggle={() => toggle(character)}
					onAddCopy={() =>
						setupSelection.setCopies(character.id, setupSelection.copies(character.id) + 1)}
				/>
			{/snippet}
		</CharacterPicker>
	</ErrorBoundary>

	<div class="actions">
		<Button
			variant="quiet"
			disabled={!ready || ids.length === 0}
			onclick={() => setupSelection.clear()}>Clear</Button
		>
		<Button variant="quiet" disabled={!ready} onclick={random}>Random</Button>
		<Button variant="quiet" icon="warning" disabled={!ready} onclick={() => (checkOpen = true)}>
			Check <span class="badge" data-testid="warning-count">{warnings.length}</span>
		</Button>
		<Button
			variant="accent"
			icon="bag"
			disabled={!ready || plan.tiles.length === 0}
			onclick={() => requestBuild()}>Build bag</Button
		>
	</div>
</main>

{#if ready}
	<SetupCheckDialog
		bind:open={checkOpen}
		{analysis}
		{plan}
		{jinxes}
		{warnings}
		{lookup}
		onStandIn={(id, shows) => setupSelection.setStandIn(id, shows)}
	/>
{/if}
<Dialog
	bind:open={errorsOpen}
	role="alertdialog"
	title="Build with errors?"
	description="This bag doesn't match the setup for {s.players} players."
>
	<ul class="errors" data-testid="build-errors">
		{#each errors as error, i (i)}<li><GlossaryText text={error} /></li>{/each}
	</ul>
	{#snippet actions()}
		<Button variant="accent" onclick={() => (errorsOpen = false)}>Go back</Button>
		<Button variant="quiet" onclick={() => requestBuild(true)}>Build anyway</Button>
	{/snippet}
</Dialog>
<Dialog
	bind:open={replaceOpen}
	role="alertdialog"
	title="Replace the bag?"
	description="Tiles have already been drawn from the current bag."
>
	<p>A new bag starts the draw again. Characters already on seats stay.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (replaceOpen = false)}>Keep</Button>
		<Button variant="accent" onclick={buildBag}>Replace</Button>
	{/snippet}
</Dialog>

<style>
	main {
		max-width: calc(64 * var(--u));
		margin: 0 auto;
		padding: var(--space-4) var(--space-4) 0;
	}
	.top {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
	}
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.script {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
	}
	.script .label {
		color: var(--on-surface-muted);
	}
	.script .name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding-top: var(--space-2);
	}
	/* Only the chosen counts stay in view while scrolling; the setup table scrolls away. */
	.counts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		position: sticky;
		top: 0;
		z-index: var(--z-raised);
		padding: var(--space-2) 0;
		background: var(--page-background, var(--surface));
	}
	.players {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.players > span {
		flex: 1;
	}
	.step {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.step:hover {
		background: var(--surface-selected);
	}
	.step:disabled {
		opacity: 0.5;
		cursor: default;
	}
	output {
		min-width: 2ch;
		font-size: 1.4rem;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.actions {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(4, auto);
		justify-content: end;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
		background: var(--page-background, var(--surface));
	}
	.errors {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-inline-start: 1.2em;
	}
	.badge {
		display: inline-block;
		min-width: 2ch;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 30rem) {
		.actions {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
