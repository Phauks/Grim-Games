<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, GameData, LoadedScript } from '#lib/core/data/index.ts';
	import { MAX_PLAYERS, MIN_PLAYERS } from '#lib/core/engine/index.ts';
	import {
		bannedIn,
		campaignRule,
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
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import ScriptChoiceLabel from '#lib/features/scripts/ScriptChoiceLabel.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import AddModeDialog from './AddModeDialog.svelte';
	import { allModes, customModes, findMode } from './custom-modes.svelte.ts';
	import ModeAbout from './ModeAbout.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ModeValue from './ModeValue.svelte';
	import RestrictedDialog from './RestrictedDialog.svelte';
	import { loadLinkedScript, loadScriptChoice, scriptChoices } from './script-choices.svelte.ts';
	import { campaigns } from './campaigns.ts';
	import { continueCampaign, startHref, startInMode, startTowns } from './start.ts';

	/**
	 * New game's Game modes area (Trevor, 2026-10-17: modes are their own area because they
	 * differ so much). Each mode shows only what it needs: a script where it plays one, a
	 * script per town where the Storyteller picks them, its own scripts where it has them, and
	 * none where it plays every character.
	 */
	interface Props {
		/** New game's own Standard game: script, players and Start (Grimoire board thread). */
		standard: Snippet;
	}

	let { standard }: Props = $props();

	onMount(() => void restoreScripts());

	// Standard first, then every mode (Trevor, 2026-10-18: one screen, modes in a drop-down).
	const modes = $derived([STANDARD, ...allModes().filter((m) => m.id !== STANDARD.id)]);
	let modeId = $state(STANDARD.id);
	const isStandard = $derived(modeId === STANDARD.id);
	const custom = $derived(customModes.list.some((m) => m.id === modeId));
	let adding = $state(false);
	let deleting = $state(false);
	const mode = $derived<GameMode>(findMode(modeId) ?? STANDARD);
	const pool = $derived(mode.parts.pool);
	const towns = $derived(mode.parts.towns);
	let restrictions = $state(NO_RESTRICTIONS);
	let players = $state(8);
	let starting = $state(false);
	let inspecting = $state(false);
	let restricting = $state(false);
	let restrictPool = $state.raw<readonly Character[]>([]);

	const choices = $derived(scriptChoices());
	/** "by Author · vN" for a drop-down's line under the name, as ScriptByline words it. */
	const byline = (c: { author?: string; version?: string }) =>
		[
			c.author ? t('player.byAuthor', { author: c.author }) : undefined,
			c.version ? t('player.version', { version: c.version }) : undefined
		]
			.filter(Boolean)
			.join(' · ');

	/**
	 * A campaign mode (Flesh and Bone) asks which campaign: a new one starts from a script
	 * chosen here, an ongoing one plays one of its saved script versions, the latest unless
	 * changed (Trevor, 2026-10-18).
	 */
	const ongoing = $derived(
		campaignRule(mode) ? campaigns().filter((c) => c.modeId === mode.id) : []
	);
	let campaignId = $state('new');
	const continuing = $derived(ongoing.find((c) => c.campaignId === campaignId));
	let version = $state('');
	const versions = $derived(
		(continuing?.games ?? []).flatMap((g, i) =>
			g.script
				? [
						{
							value: String(i),
							label: `${t('modes.campaign.game', { number: i + 1 })} · ${g.script.meta?.name ?? ''}`
						}
					]
				: []
		)
	);
	const versionValue = $derived(
		versions.some((v) => v.value === version) ? version : (versions.at(-1)?.value ?? '')
	);
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
			const script = continuing?.games[Number(versionValue)]?.script;
			if (continuing && script) {
				const latest = continuing.games.at(-1);
				const previous = latest ? await OpenGame.open(data, latest.gameId) : undefined;
				const open = await continueCampaign(
					{
						campaign: continuing,
						script,
						...(previous ? { latest: previous } : {}),
						create: (s) => OpenGame.create(data, s, previous?.game.seating.length ?? total)
					},
					(name, number) => t('modes.campaign.scriptName', { name, number })
				);
				await goto(startHref(modeId, open.game.gameId));
				return;
			}
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
		<!-- One drop-down for the mode (Trevor, 2026-10-18: "a dropdown, not buttons"). -->
		<Select
			label={t('modes.label')}
			value={modeId}
			options={modes.map((m) => ({ value: m.id, label: m.name }))}
			onChange={(v) => {
				modeId = v;
				restrictions = NO_RESTRICTIONS;
				campaignId = 'new';
			}}
		/>
	</div>
	<!-- Each mode's About, one line a row so switching modes moves nothing (Trevor, 2026-10-18). -->
	{#if !isStandard}
		<section class="about" aria-labelledby="mode-about-title">
			<h3 id="mode-about-title">{t('modes.about')}</h3>
			<ModeAbout {mode} compact />
		</section>
	{/if}
	<div class="tools">
		<Button icon="info" onclick={() => (inspecting = true)}>
			{t('modes.inspect', { name: mode.name })}
		</Button>
		<Button icon="add" onclick={() => (adding = true)}>{t('modes.add.button')}</Button>
		<!-- Always there, so nothing moves; only a mode added on this device can go. -->
		<DeleteButton
			label={t('modes.add.delete', { name: mode.name })}
			disabled={!custom}
			onclick={() => (deleting = true)}
		/>
	</div>

	{#if isStandard}
		{@render standard()}
	{:else}
		{#if ongoing.length > 0}
			<Select
				label={t('modes.campaign.choose')}
				value={campaignId}
				options={[
					{ value: 'new', label: t('modes.campaign.new') },
					...ongoing.map((c) => ({
						value: c.campaignId,
						label: t('modes.campaign.ongoing', {
							name: c.games[0]?.script?.meta?.name ?? mode.name,
							date: new Date(c.createdAt).toLocaleDateString()
						}),
						description: t('library.campaignVersions', { count: c.games.length })
					}))
				]}
				onChange={(v) => (campaignId = v)}
			/>
		{/if}
		{#if continuing}
			<Select
				label={t('modes.campaign.version')}
				value={versionValue}
				options={versions}
				onChange={(v) => (version = v)}
			/>
		{:else if scriptKind === 'one'}
			<ChoiceGroup
				label={t('modes.script')}
				value={script}
				options={choices}
				onChange={(v) => (script = v)}
			>
				{#snippet item(option)}
					{@const c = choices.find((x) => x.value === option.value)}
					<ScriptChoiceLabel label={option.label} author={c?.author} version={c?.version} />
				{/snippet}
			</ChoiceGroup>
		{:else if scriptKind === 'per-town'}
			{#each Array.from({ length: towns?.count ?? 2 }, (_, i) => i) as i (i)}
				<Select
					label={t('modes.townScript', { number: i + 1 })}
					value={townScripts[i] ?? 'tb'}
					options={choices.map((c) => ({
						value: c.value,
						label: c.label,
						...(c.author || c.version ? { description: byline(c) } : {})
					}))}
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

		<!-- The same count and setup sheet as Standard (Trevor, 2026-10-18). -->
		<PlayerCountSheet
			players={total}
			min={minPlayers}
			max={maxPlayers}
			onChange={(n) => (players = n)}
		/>
		{#if sizes}
			<p class="sizes" data-testid="town-sizes">
				{sizes.map((n, i) => t('modes.townPlayers', { number: i + 1, count: n })).join(' · ')}
			</p>
		{/if}

		<Button icon="restricted" onclick={openRestricted}>
			{t('modes.restrictedButton', { count: restrictedCount })}
		</Button>
		<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}>
			{t('modes.start')}
		</Button>
	{/if}
</div>

<ModeInspectDialog bind:open={inspecting} {mode} />
<AddModeDialog
	bind:open={adding}
	onadded={(m) => {
		modeId = m.id;
		restrictions = NO_RESTRICTIONS;
	}}
/>
<ConfirmDialog
	bind:open={deleting}
	title={t('modes.add.deleteConfirm', { name: mode.name })}
	danger
	onConfirm={() => {
		customModes.remove(modeId);
		modeId = STANDARD.id;
		restrictions = NO_RESTRICTIONS;
	}}
/>
<RestrictedDialog
	bind:open={restricting}
	{mode}
	characters={restrictPool}
	{restrictions}
	onChange={(next) => (restrictions = next)}
/>

<style>
	.about h3 {
		margin: 0;
		font-size: 1.05rem;
	}
	.modes {
		display: grid;
		gap: var(--space-3);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
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
