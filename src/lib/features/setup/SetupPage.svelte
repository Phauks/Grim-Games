<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
		scriptFacts,
		selectedIds,
		isRuleCharacter
	} from '#lib/core/rules/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterSearchBox from '#lib/features/characters/CharacterSearchBox.svelte';
	import CharacterChoice from './CharacterChoice.svelte';
	import CountsBar from './CountsBar.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import SetupCheckPanel from './SetupCheckPanel.svelte';
	import StandInDialog from './StandInDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SetupTable from './SetupTable.svelte';
	import SetupSteps from './SetupSteps.svelte';
	import SetupNav from './SetupNav.svelte';
	import JoinButton from './JoinButton.svelte';
	import { currentSetupStep } from './setup-steps.ts';
	import { buildErrors, setupWarningMessages } from './build-check.ts';
	import { MAX_SELECT_PLAYERS, MIN_SELECT_PLAYERS, setupSelection } from './selection.svelte.ts';

	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	let clearOpen = $state(false);
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
			standIns: s.standIns
		})
	);
	// The Lunatic's Demon token, changed from the setup check.
	let askingFor = $state<CharacterId | undefined>(undefined);
	let standInOpen = $state(false);
	const askingStandIn = $derived(plan.standIns.find((x) => x.characterId === askingFor));
	const ids = $derived(selectedIds(s.selection, scriptOrder));
	const name = (id: CharacterId) => lookup(id)?.name ?? id;
	// Jinxes and the Djinn from the characters chosen for play; "requires" from the whole
	// script, to know whether the required character could be put in play at all.
	const facts = $derived(
		data && script
			? scriptFacts(
					ids.map((id) => lookup(id)).filter((c): c is Character => c !== undefined),
					data.jinxes,
					script.homebrewJinxes
				)
			: undefined
	);
	const requirements = $derived(
		data && script
			? scriptFacts(script.characters, data.jinxes, script.homebrewJinxes).requirements
			: []
	);
	const jinxes = $derived(facts?.jinxes ?? []);
	const jinxed = $derived(new Set(jinxes.flatMap((j) => j.characters)));
	const travellers = $derived(ids.filter((id) => lookup(id)?.type === 'traveller').length);
	const warnings = $derived([
		...setupWarningMessages(analysis.warnings, requirements, name),
		...plan.issues.map((i) => i.message),
		...jinxSetupWarnings(jinxes, ids, name).map((w) => w.message)
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
	const bagTiles = $derived(Object.values(game?.bag?.tiles ?? {}));
	const drawnCount = $derived(bagTiles.filter((t) => t.drawnBySeat !== undefined).length);
	const drawStarted = $derived(drawnCount > 0);

	function send(command: Command): boolean {
		const result = port.dispatch(command);
		if (!result.ok) toast(t('setup.couldNot'), result.error.message);
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
		const built = send({
			type: 'BuildBag',
			tiles: plan.tiles,
			includeTravellers: plan.includeTravellers,
			unseated: plan.unseated
		});
		if (!built) return;
		await port.flush();
		await goto(resolve('/grimoire/[gameId]/draw', { gameId: game.gameId }));
	}

	function random() {
		const selection = randomSelection({
			players: s.players,
			// A fresh draw on every tap (Trevor, 2026-10-16), not a top-up of the current one.
			selection: {},
			scriptCharacters: choices,
			scriptOrder,
			lookup,
			findByName,
			random: Math.random
		});
		setupSelection.replace(selection);
	}
</script>

<main>
	<header class="top">
		{#if game}
			<SetupSteps
				gameId={game.gameId}
				current="characters"
				hasBag={currentSetupStep(game) !== 'characters'}
			/>
		{/if}
		<div class="title">
			<h1>{t('setup.characters')}</h1>
			{#if port.openGame}<JoinButton game={port.openGame} />{/if}
		</div>
		<p class="script">
			<span class="label">{t('setup.script')}</span>
			<span class="name" data-testid="setup-script-name">{script?.name ?? t('common.none')}</span>
		</p>
	</header>

	<ErrorBoundary area="setup">
		<div class="layout">
			<div class="side">
				<section class="controls" aria-label={t('setup.players')}>
					<div class="players">
						<span id="players-label">{t('setup.players')}</span>
						<button
							type="button"
							class="step"
							aria-label={t('setup.fewerPlayers')}
							disabled={s.players <= MIN_SELECT_PLAYERS}
							onclick={() => setupSelection.setPlayers(s.players - 1)}>−</button
						>
						<output aria-labelledby="players-label" data-testid="player-count">{s.players}</output>
						<button
							type="button"
							class="step"
							aria-label={t('setup.morePlayers')}
							disabled={s.players >= MAX_SELECT_PLAYERS}
							onclick={() => setupSelection.setPlayers(s.players + 1)}>+</button
						>
					</div>
					<Collapsible title={t('setup.sheet')} storageKey="setup:sheet">
						<SetupTable players={s.players} onPick={(n) => setupSelection.setPlayers(n)} />
					</Collapsible>
				</section>
				<div class="counts">
					<CountsBar {analysis} {travellers} />
					<div class="find">
						<CharacterSearchBox bind:query shortcut />
						<div class="tools">
							<IconButton
								icon="random"
								label={t('setup.random')}
								disabled={!ready}
								onclick={random}
							/>
							<IconButton
								icon="clearSelection"
								label={t('setup.clearSelection')}
								disabled={!ready || ids.length === 0}
								onclick={() => (clearOpen = true)}
							/>
						</div>
					</div>
				</div>
				{#if ready}
					<SetupCheckPanel
						{analysis}
						{plan}
						{jinxes}
						djinn={facts?.djinn ?? false}
						{warnings}
						{lookup}
						onStandIn={(id) => {
							askingFor = id;
							standInOpen = true;
						}}
					/>
				{/if}
			</div>

			<CharacterPicker
				characters={choices}
				mode="multi"
				selected={ids}
				bind:query
				showSearch={false}
				collapsibleKey="setup"
				surface="page"
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
		</div>
	</ErrorBoundary>

	{#if game}
		<SetupNav
			backHref={resolve('/grimoire/[gameId]', { gameId: game.gameId })}
			backLabel={t('setup.grimoire')}
		>
			{#snippet next()}
				<Button
					variant="accent"
					icon="bag"
					disabled={!ready || plan.tiles.length === 0}
					onclick={() => requestBuild()}>{t('setup.buildBag')}</Button
				>
			{/snippet}
		</SetupNav>
	{/if}
</main>

<StandInDialog
	bind:open={standInOpen}
	standIn={askingStandIn}
	{lookup}
	onChoose={(shows) => askingFor && setupSelection.setStandIn(askingFor, shows)}
/>
<ConfirmDialog
	bind:open={clearOpen}
	title={t('setup.clear.title')}
	danger
	onConfirm={() => setupSelection.clear()}
>
	<p>{t('setup.clear.body', { count: ids.length })}</p>
</ConfirmDialog>
<ConfirmDialog
	bind:open={errorsOpen}
	title={t('setup.errors.title')}
	description={t('setup.errors.description', { players: s.players })}
	onConfirm={() => requestBuild(true)}
>
	<ul class="errors" data-testid="build-errors">
		{#each errors as error, i (i)}<li><GlossaryText text={error} /></li>{/each}
	</ul>
</ConfirmDialog>
<ConfirmDialog bind:open={replaceOpen} title={t('setup.replace.title')} danger onConfirm={buildBag}>
	<p>
		{t('setup.replace.body', {
			count: drawnCount,
			total: bagTiles.length,
			tiles: plan.tiles.length
		})}
	</p>
</ConfirmDialog>

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-4) var(--page-gutter) 0;
	}
	.top {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
	}
	h1 {
		margin: var(--space-2) 0 0;
		overflow-wrap: anywhere;
	}
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
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
	/* Search, then Random and Clear as icon buttons right beside it. */
	.find {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.tools {
		display: flex;
		gap: var(--space-1);
	}
	.tools :global(.icon-button) {
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	@media (hover: hover) {
		.tools :global(.icon-button:hover:not(:disabled)) {
			background: var(--surface-selected);
		}
	}
	/* Phones and tablets: one column. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.side {
		display: contents;
	}
	/*
	 * A computer window: players, setup sheet, counts, search and the check in a column beside
	 * the list, so the list starts at the top and nothing needs scrolling back to.
	 */
	@media (min-width: 75rem) {
		.layout {
			grid-template-columns: calc(28 * var(--u)) minmax(0, 1fr);
			align-items: start;
			gap: var(--space-5);
			padding-top: var(--space-2);
		}
		.side {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-2);
			position: sticky;
			top: 0;
			max-height: calc(100dvh - 6 * var(--u));
			overflow-y: auto;
			padding-bottom: var(--space-4);
		}
		.counts {
			position: static;
		}
	}
	.errors {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-inline-start: 1.2em;
	}
</style>
