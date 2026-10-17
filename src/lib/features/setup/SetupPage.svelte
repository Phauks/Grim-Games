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
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterSearchBox from '#lib/features/characters/CharacterSearchBox.svelte';
	import CharacterChoice from './CharacterChoice.svelte';
	import CountsBar from './CountsBar.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import SetupCheckPanel from './SetupCheckPanel.svelte';
	import StandInDialog from './StandInDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import PlayerCountSheet from './PlayerCountSheet.svelte';
	import SetupNav from './SetupNav.svelte';
	import SetupActions from './SetupActions.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { buildErrors, setupWarningMessages, uncuratedReminderCharacters } from './build-check.ts';
	import { setupSelection } from './selection.svelte.ts';

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
	// Jinxes from the characters chosen for play; "requires" from the whole
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
	const uncurated = $derived(uncuratedReminderCharacters(inPlay));

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
	/**
	 * The bag in the game holds what is chosen now: Build bag goes back to its draw rather
	 * than starting a new one (Trevor, 2026-10-17).
	 */
	const sameBag = $derived.by(() => {
		const key = (ids: string[]) => [...ids].sort().join('|');
		return (
			bagTiles.length > 0 &&
			key(bagTiles.map((t) => t.grimoire)) === key(plan.tiles.map((t) => t.grimoire)) &&
			key((game?.bag?.unseated ?? []).map((r) => r.label)) ===
				key(plan.unseated.map((r) => r.label))
		);
	});

	function requestBuild(confirmedErrors = false) {
		errorsOpen = false;
		if (sameBag && game) void goto(resolve('/grimoire/[gameId]/draw', { gameId: game.gameId }));
		else if (!confirmedErrors && errors.length > 0) errorsOpen = true;
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

<Page title={t('setup.characters')} sideFlow>
	{#snippet actions()}<SetupActions {port} />{/snippet}
	{#snippet subtitle()}<span class="script"
			><span class="label">{t('setup.script')}</span>
			<span class="name" data-testid="setup-script-name">{script?.name ?? t('common.none')}</span
			></span
		>{/snippet}
	{#snippet side()}
		<ErrorBoundary area="setup">
			<PlayerCountSheet players={s.players} onChange={(n) => setupSelection.setPlayers(n)} />
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
					{warnings}
					{lookup}
					{uncurated}
					onStandIn={(id) => {
						askingFor = id;
						standInOpen = true;
					}}
				/>
			{/if}
		</ErrorBoundary>
	{/snippet}

	<ErrorBoundary area="setup">
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
					onclick={() => requestBuild()}
					>{sameBag ? t('setup.continueDraw') : t('setup.buildBag')}</Button
				>
			{/snippet}
		</SetupNav>
	{/if}
</Page>

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
	.script {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: var(--space-2);
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
	/* Only the chosen counts stay in view while scrolling; the setup table scrolls away. */
	.counts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		position: sticky;
		/* Just below the app header, which is sticky too (as the sidebar does). */
		top: calc(var(--tap-target) + env(safe-area-inset-top));
		z-index: var(--z-raised);
		padding: var(--space-2) 0;
		background: var(--page-background, var(--surface));
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
	/* A computer window: the counts sit in the side column, which is sticky itself. */
	@media (min-width: 75rem) {
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
