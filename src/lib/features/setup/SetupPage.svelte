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
		scriptFacts,
		selectedIds,
		travellerRange,
		isRuleCharacter,
		validRandomSelection
	} from '#lib/core/rules/index.ts';
	import { scriptMaxPlayers, teensyvilleWarnings } from '#lib/core/rules/teensyville.ts';
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
	import AddCharactersDialog from './AddCharactersDialog.svelte';
	import SetupBluffs from '#lib/features/bluffs/SetupBluffs.svelte';
	import { DEMON_SET } from '#lib/features/bluffs/bluffs.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import PlayerCountSheet from './PlayerCountSheet.svelte';
	import SetupNav from './SetupNav.svelte';
	import SetupActions from './SetupActions.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { buildErrors, setupWarningMessages, uncuratedReminderCharacters } from './build-check.ts';
	import { setupSelection } from './selection.svelte.ts';
	import { gameModeOf } from '#lib/features/modes/game-mode.ts';
	import { afterTownBag } from '#lib/features/modes/town-setup.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import {
		MAX_STORYTELLER_NAME,
		storytellerName
	} from '#lib/features/game/storyteller-name.svelte.ts';

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

	/**
	 * Who runs the game, named here where the characters are picked rather than on New game
	 * (Trevor, 2026-10-19). Saved to the game when the field is left or Enter is pressed, so
	 * the game's history gets one entry, not one per letter; also kept as the next game's name.
	 */
	let storyteller = $state<string>();
	const shownStoryteller = $derived(storyteller ?? game?.storytellerName ?? '');
	function saveStoryteller() {
		if (storyteller === undefined || !game) return;
		const name = storyteller.trim();
		if (name !== (game.storytellerName ?? '')) send({ type: 'SetStorytellerName', name });
		storyteller = undefined;
	}

	const lookup = (id: CharacterId): Character | undefined => port.lookup?.get(id);
	const findByName = (name: string) =>
		[...(port.lookup?.values() ?? [])].find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;

	// Fabled and Loric are rule characters: the grimoire adds them, the bag never holds them.
	const choices = $derived(script?.characters.filter((c) => !isRuleCharacter(c.type)) ?? []);
	const scriptOrder = $derived(choices.map((c) => c.id));
	/**
	 * Travellers listed first (Trevor, 2026-10-18): the script's own, then, on an official
	 * edition, that edition's, which aren't on its sheet but go with it.
	 */
	const editionTravellers = $derived(
		script?.edition && data
			? data.characters.filter(
					(c) =>
						c.type === 'traveller' && c.edition === script.edition && !scriptOrder.includes(c.id)
				)
			: []
	);
	/**
	 * The script's own Fabled and Loric, then any other the game has in play (Trevor,
	 * 2026-10-18). They go straight into the game's rule characters, never the bag; once
	 * listed they stay for this visit, so taking one out can be undone.
	 */
	const scriptRules = $derived(script?.characters.filter((c) => isRuleCharacter(c.type)) ?? []);
	const inRule = $derived(new Set(game?.ruleCharacters ?? []));
	let rulesSeen = $state.raw<CharacterId[]>([]);
	$effect(() => {
		const onScript = new Set(scriptRules.map((c) => c.id));
		const added = (game?.ruleCharacters ?? []).filter(
			(id) => !onScript.has(id) && !rulesSeen.includes(id)
		);
		if (added.length) rulesSeen = [...rulesSeen, ...added];
	});
	const offScriptRules = $derived(
		rulesSeen.map((id) => lookup(id)).filter((c): c is Character => c !== undefined)
	);
	/** Every character of a type there is, the script's (and edition's) first, for its Add dialog. */
	function allOf(type: CharacterType): Character[] {
		const recommended = [...(script?.characters ?? []), ...editionTravellers].filter(
			(c) => c.type === type
		);
		const seen = new Set(recommended.map((c) => c.id));
		return [
			...recommended,
			...(data?.characters ?? []).filter((c) => c.type === type && !seen.has(c.id))
		];
	}
	/** Which type's Add dialog is open: Travellers, Fabled or Loric. */
	let adding = $state<'traveller' | 'fabled' | 'loric' | undefined>(undefined);
	const ADD_LABELS = {
		traveller: { button: 'setup.addTraveller', title: 'setup.allTravellers' },
		fabled: { button: 'setup.addFabled', title: 'setup.allFabled' },
		loric: { button: 'setup.addLoric', title: 'setup.allLoric' }
	} as const;
	/**
	 * Travellers are rarely in play, so their section starts closed (Trevor, 2026-10-18),
	 * unless one was already chosen when the screen opened (a resumed setup).
	 */
	let travellersChosenAtStart = $state<boolean | undefined>(undefined);
	/**
	 * Characters chosen though they are not on the script (Infinite Possibilities' hidden
	 * extras, or any other addition), listed under their own type with an off-script mark
	 * (Trevor, 2026-10-18). Once listed they stay for this visit, so taking one out can be
	 * undone.
	 */
	let offScriptSeen = $state.raw<CharacterId[]>([]);
	$effect(() => {
		const onScript = new Set([...scriptOrder, ...editionTravellers.map((c) => c.id)]);
		const added = Object.keys(s.selection).filter(
			(id) => (s.selection[id] ?? 0) > 0 && !onScript.has(id) && !offScriptSeen.includes(id)
		);
		if (added.length) offScriptSeen = [...offScriptSeen, ...added];
	});
	const offScript = $derived(
		offScriptSeen
			.map((id) => lookup(id))
			.filter((c): c is Character => c !== undefined && !isRuleCharacter(c.type))
	);
	/** Only the chosen characters, with the search still applying (Trevor, 2026-10-18). */
	let selectedOnly = $state(false);
	const listed = $derived(
		[...choices, ...editionTravellers, ...offScript, ...scriptRules, ...offScriptRules].filter(
			(c) => !selectedOnly || (s.selection[c.id] ?? 0) > 0 || inRule.has(c.id)
		)
	);
	const offScriptIds = $derived(new Set([...offScript, ...offScriptRules].map((c) => c.id)));
	/** The Demon's bluffs, chosen below the list, are tagged in it (Trevor, 2026-10-18). */
	const bluffIds = $derived(new Set(game?.bluffs[DEMON_SET] ?? []));
	const listedIds = $derived(
		new Set([...scriptOrder, ...[...editionTravellers, ...scriptRules].map((c) => c.id)])
	);
	const TYPES: CharacterType[] = [
		'townsfolk',
		'outsider',
		'minion',
		'demon',
		'traveller',
		'fabled',
		'loric'
	];

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
	// Each selected character's selected jinx partners, shown by their icons (Trevor, 2026-10-19).
	const jinxPartners = $derived.by(() => {
		const of: Record<string, Character[]> = {};
		for (const [a, b] of jinxes.map((j) => j.characters)) {
			const ca = lookup(a);
			const cb = lookup(b);
			if (ca && cb) {
				(of[a] ??= []).push(cb);
				(of[b] ??= []).push(ca);
			}
		}
		return of;
	});
	const travellers = $derived(ids.filter((id) => lookup(id)?.type === 'traveller').length);
	/**
	 * Travellers a special rule lets into the bag (Stowed Away: up to 2, the other counts for
	 * that many fewer players). Selected Travellers already lower the other counts.
	 */
	const travellersInBag = $derived(
		game ? (gameModeOf(game.gameId)?.parts.travellers?.inBag ?? 0) : 0
	);
	const travellerLimits = $derived(
		travellersInBag ? travellerRange(s.players, travellersInBag) : undefined
	);
	const warnings = $derived([
		...setupWarningMessages(analysis.warnings, requirements, name),
		...plan.issues.map((i) => i.message),
		...jinxSetupWarnings(jinxes, ids, name).map((w) => w.message),
		...(script ? teensyvilleWarnings(script.characters, s.players) : [])
	]);

	const errors = $derived(
		buildErrors({ analysis, issues: plan.issues, travellers, travellerMax: travellerLimits?.max })
	);

	// Copies only where a character's rules allow them (Village Idiot, Legion, or with the
	// Pope or Atheist in play), never through a general switch (Trevor, 2026-10-15).
	const inPlay = $derived(
		[...ids, ...(game?.ruleCharacters ?? [])]
			.map((id) => lookup(id))
			.filter((c): c is Character => c !== undefined)
	);
	const uncurated = $derived(uncuratedReminderCharacters(inPlay));

	$effect(() => {
		if (ready && travellersChosenAtStart === undefined)
			travellersChosenAtStart =
				travellersInBag > 0 || ids.some((id) => lookup(id)?.type === 'traveller');
	});

	function toggle(character: Character) {
		if (isRuleCharacter(character.type)) {
			send({
				type: inRule.has(character.id) ? 'RemoveRuleCharacter' : 'AddRuleCharacter',
				characterId: character.id
			});
			return;
		}
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
		if (sameBag && game) void openDraw(game.gameId);
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
		await openDraw(game.gameId);
	}

	/** The draw, or for a town of a mode game the next town's setup (Alternative game modes). */
	async function openDraw(gameId: string) {
		const town = await afterTownBag(gameId, await loadOfficialData());
		await goto(town?.href ?? resolve('/grimoire/[gameId]/draw', { gameId }));
		town?.seed?.();
	}

	// Random only shows a selection the setup check accepts (Trevor, 2026-10-19: "do not show
	// an invalid draw"); when none fits, the selection stays and the toast says why.
	function random() {
		const result = validRandomSelection({
			players: s.players,
			// A fresh draw on every tap (Trevor, 2026-10-16), not a top-up of the current one,
			// except for the characters the Storyteller locked (Trevor, 2026-10-19).
			selection: setupSelection.lockedSelection(),
			ruleCharacters: game?.ruleCharacters,
			// A rule's Travellers come from the recommended ones: the script's and its edition's.
			scriptCharacters: travellersInBag ? [...choices, ...editionTravellers] : choices,
			scriptOrder,
			lookup,
			findByName,
			jinxes:
				data && script
					? scriptFacts(script.characters, data.jinxes, script.homebrewJinxes).jinxes
					: [],
			random: Math.random,
			travellersInBag
		});
		if (result.ok) setupSelection.replace(result.selection);
		else
			toast(
				t(s.locked.length > 0 ? 'setup.randomNoneLocked' : 'setup.randomNone'),
				result.problems[0]
			);
	}
</script>

<Page title={t('setup.characters')} sideFlow iconActions>
	{#snippet actions()}<SetupActions {port} />{/snippet}
	{#snippet subtitle()}<span class="script"
			><span class="label">{t('setup.script')}</span>
			<span class="name" data-testid="setup-script-name">{script?.name ?? t('common.none')}</span
			></span
		>{/snippet}
	{#snippet side()}
		<ErrorBoundary area="setup">
			<div class="storyteller" onfocusout={saveStoryteller}>
				<TextField
					label={t('modes.storytellerName')}
					value={shownStoryteller}
					maxlength={MAX_STORYTELLER_NAME}
					autocomplete="off"
					disabled={!game}
					oninput={(v) => {
						storyteller = v;
						storytellerName.set(v);
					}}
					oncommit={saveStoryteller}
					testid="storyteller-name"
				/>
			</div>
			<PlayerCountSheet
				players={s.players}
				onChange={(n) => setupSelection.setPlayers(n)}
				maxPlayers={script ? scriptMaxPlayers(script.characters) : undefined}
			/>
			<!-- Under the Setup sheet: both are the technical side of the setup (Trevor, 2026-10-20). -->
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
			<div class="counts">
				<CountsBar {analysis} {travellers} {travellerLimits} />
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
							icon="selectedOnly"
							label={t('setup.selectedOnly')}
							aria-pressed={selectedOnly}
							disabled={!ready}
							onclick={() => (selectedOnly = !selectedOnly)}
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
		</ErrorBoundary>
	{/snippet}

	<ErrorBoundary area="setup">
		<CharacterPicker
			characters={listed}
			mode="multi"
			selected={[...ids, ...inRule]}
			bind:query
			showSearch={false}
			collapsibleKey="setup"
			surface="page"
			contained={false}
			types={TYPES}
			keepTypes={['traveller', 'fabled', 'loric']}
			closedTypes={travellersChosenAtStart ? ['fabled', 'loric'] : ['traveller', 'fabled', 'loric']}
			onSelect={(id) => {
				const character = lookup(id);
				if (character) toggle(character);
			}}
		>
			{#snippet groupAside(type)}
				{#if type === 'traveller' || type === 'fabled' || type === 'loric'}
					<IconButton
						icon="add"
						label={t(ADD_LABELS[type].button)}
						disabled={!ready}
						onclick={() => (adding = type)}
					/>
				{/if}
			{/snippet}
			{#snippet item(character)}
				<CharacterChoice
					{character}
					copies={isRuleCharacter(character.type)
						? inRule.has(character.id)
							? 1
							: 0
						: (s.selection[character.id] ?? 0)}
					duplicates={!isRuleCharacter(character.type) && canDuplicate(character, inPlay)}
					jinxedWith={jinxPartners[character.id]}
					offScript={offScriptIds.has(character.id)}
					bluff={bluffIds.has(character.id)}
					onToggle={() => toggle(character)}
					locked={s.locked.includes(character.id)}
					onLock={isRuleCharacter(character.type)
						? undefined
						: () => setupSelection.toggleLock(character.id)}
					onAddCopy={() =>
						setupSelection.setCopies(character.id, setupSelection.copies(character.id) + 1)}
				/>
			{/snippet}
		</CharacterPicker>
		<!--
			The Demon's bluffs, from the characters chosen here rather than on the Draw screen the
			players use (Trevor, 2026-10-18). Always there, even before a Demon is chosen.
		-->
		{#if game && port.lookup}
			<SetupBluffs
				{game}
				characters={port.lookup}
				dispatch={port.dispatch}
				waiting={!ready}
				inPlay={ids}
				always
			/>
		{/if}
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

{#if adding}
	{@const type = adding}
	<AddCharactersDialog
		bind:open={() => adding === type, (open) => (adding = open ? type : undefined)}
		title={t(ADD_LABELS[type].title)}
		{type}
		characters={allOf(type)}
		selected={[...ids, ...inRule]}
		marker={(c) => (listedIds.has(c.id) ? undefined : t('setup.offScript'))}
		onToggle={(id) => {
			const character = lookup(id);
			if (character) toggle(character);
		}}
	/>
{/if}
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
		/* Edge to edge, like the app header above it, so nothing shows beside it (Trevor). */
		margin-inline: calc(-1 * var(--page-gutter));
		padding: var(--space-2) var(--page-gutter);
		/* The page's own background, pinned to the window as the body's is, so it lines up. */
		background: var(--page-background, var(--surface));
		background-attachment: fixed;
		box-shadow: 0 1px 0 var(--border);
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
			margin-inline: 0;
			padding-inline: 0;
			background: none;
			box-shadow: none;
		}
	}
	.errors {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-inline-start: 1.2em;
	}
</style>
