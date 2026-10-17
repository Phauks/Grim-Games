<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, GameData, LoadedScript } from '#lib/core/data/index.ts';
	import { MAX_PLAYERS, MIN_PLAYERS } from '#lib/core/engine/index.ts';
	import {
		bannedIn,
		GAME_MODES,
		gameModeById,
		modeCharacters,
		NO_RESTRICTIONS,
		STANDARD,
		townSizes,
		type GameMode
	} from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ModeValue from './ModeValue.svelte';
	import RestrictedDialog from './RestrictedDialog.svelte';
	import { loadLinkedScript, loadScriptChoice, scriptChoices } from './script-choices.svelte.ts';
	import { startHref, startInMode, startTowns } from './start.ts';

	/**
	 * New game's Game modes area (Trevor, 2026-10-17: modes are their own area because they
	 * differ so much). Each mode shows only what it needs: a script where it plays one, a
	 * script per town where the Storyteller picks them, its own scripts where it has them, and
	 * none where it plays every character.
	 */
	onMount(() => void restoreScripts());

	const modes = GAME_MODES.filter((m) => m.id !== STANDARD.id);
	let modeId = $state(modes[0].id);
	const mode = $derived<GameMode>(gameModeById(modeId) ?? STANDARD);
	const pool = $derived(mode.parts.pool);
	const towns = $derived(mode.parts.towns);
	let restrictions = $state(NO_RESTRICTIONS);
	let players = $state(8);
	let starting = $state(false);
	let inspecting = $state(false);
	let restricting = $state(false);
	let restrictPool = $state.raw<readonly Character[]>([]);

	const choices = $derived(scriptChoices());
	let script = $state('tb');
	/** Per-town picks, for a mode whose towns' scripts the Storyteller chooses. */
	let townScripts = $state<string[]>(['tb', 'bmr']);

	/** How the script is chosen for this mode. */
	const scriptKind = $derived(
		pool?.kind === 'all-characters'
			? 'none'
			: pool?.kind === 'per-town'
				? pool.scripts.length > 0
					? 'fixed'
					: 'per-town'
				: 'one'
	);
	// Separate towns each need a full game's players (5 to 15).
	const split = $derived(towns && !towns.samePlayers ? towns.count : 1);
	const minPlayers = $derived(MIN_PLAYERS * split);
	const maxPlayers = $derived(MAX_PLAYERS * split);
	const total = $derived(Math.min(maxPlayers, Math.max(minPlayers, players)));
	const sizes = $derived(split > 1 ? townSizes(total, split) : undefined);
	const restrictedCount = $derived(bannedIn(mode, restrictions).size);

	async function loadScripts(data: GameData): Promise<LoadedScript[]> {
		if (pool?.kind === 'per-town' && pool.scripts.length > 0)
			return Promise.all(pool.scripts.map((link) => loadLinkedScript(link, data)));
		if (scriptKind === 'per-town')
			return townScripts.slice(0, towns?.count ?? 2).map((c) => loadScriptChoice(c, data));
		return [loadScriptChoice(scriptKind === 'none' ? 'tb' : script, data)];
	}

	async function openRestricted() {
		try {
			const data = await loadOfficialData();
			const loaded = await loadScripts(data);
			const scriptCharacters = [
				...new Map(loaded.flatMap((l) => l.characters).map((c) => [c.id, c])).values()
			];
			restrictPool = modeCharacters(mode, scriptCharacters, data.characters, {
				banned: [],
				allowed: mode.parts.restricted?.banned ?? []
			});
			restricting = true;
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	}

	async function start() {
		starting = true;
		try {
			const data = await loadOfficialData();
			const loaded = await loadScripts(data);
			if (towns && towns.count > 1) {
				const groupId = await startTowns({
					modeId,
					restrictions,
					data,
					scripts: loaded,
					sizes: sizes ?? Array.from({ length: towns.count }, () => total),
					create: (s, n) => OpenGame.create(data, s, n)
				});
				await goto(resolve('/towns/[groupId]', { groupId }));
				return;
			}
			const open = await startInMode({
				modeId,
				restrictions,
				data,
				loaded: loaded[0],
				create: (s) => OpenGame.create(data, s, total)
			});
			await goto(startHref(modeId, open.game.gameId));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<div class="modes">
	<div class="pick">
		<ChoiceGroup
			label={t('modes.label')}
			value={modeId}
			options={modes.map((m) => ({ value: m.id, label: m.name }))}
			onChange={(v) => {
				modeId = v;
				restrictions = NO_RESTRICTIONS;
			}}
		/>
	</div>
	<Button icon="info" onclick={() => (inspecting = true)}>
		{t('modes.inspect', { name: mode.name })}
	</Button>

	{#if scriptKind === 'one'}
		<ChoiceGroup
			label={t('modes.script')}
			value={script}
			options={choices}
			onChange={(v) => (script = v)}
		/>
	{:else if scriptKind === 'per-town'}
		{#each Array.from({ length: towns?.count ?? 2 }, (_, i) => i) as i (i)}
			<Select
				label={t('modes.townScript', { number: i + 1 })}
				value={townScripts[i] ?? 'tb'}
				options={choices}
				onChange={(v) => (townScripts[i] = v)}
			/>
		{/each}
	{:else if scriptKind === 'fixed' && pool?.kind === 'per-town'}
		<dl class="fixed">
			{#each pool.scripts as link, i (link.url)}
				<dt>{t('modes.townScript', { number: i + 1 })}</dt>
				<dd><ModeValue field="script" value={link} /></dd>
			{/each}
		</dl>
	{:else}
		<p class="muted">{t('modes.everyCharacter')}</p>
	{/if}

	<div class="players">
		<span class="label" id="mode-players-label">{t('modes.players')}</span>
		<IconButton
			icon="back"
			label={t('modes.fewerPlayers')}
			disabled={total <= minPlayers}
			onclick={() => (players = total - 1)}
		/>
		<output aria-labelledby="mode-players-label">{total}</output>
		<IconButton
			icon="forward"
			label={t('modes.morePlayers')}
			disabled={total >= maxPlayers}
			onclick={() => (players = total + 1)}
		/>
	</div>
	{#if sizes}
		<p class="sizes" data-testid="town-sizes">
			{sizes.map((n, i) => t('modes.townPlayers', { number: i + 1, count: n })).join(' · ')}
		</p>
	{:else}
		<SetupTable players={total} />
	{/if}

	<Button icon="filter" onclick={openRestricted}>
		{t('modes.restrictedButton', { count: restrictedCount })}
	</Button>
	<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}>
		{t('modes.start')}
	</Button>
</div>

<ModeInspectDialog bind:open={inspecting} {mode} />
<RestrictedDialog
	bind:open={restricting}
	{mode}
	characters={restrictPool}
	{restrictions}
	onChange={(next) => (restrictions = next)}
/>

<style>
	.modes {
		display: grid;
		gap: var(--space-3);
		padding-top: var(--space-3);
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
	.fixed {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.fixed dd {
		margin: 0;
	}
	.muted,
	.fixed dt {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.sizes {
		margin: 0;
	}
</style>
