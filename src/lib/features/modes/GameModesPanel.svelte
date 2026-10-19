<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, GameData, LoadedScript } from '#lib/core/data/index.ts';
	import { MAX_PLAYERS, MAX_SEATS, MIN_PLAYERS } from '#lib/core/engine/index.ts';
	import {
		bannedIn,
		campaignRule,
		modeCharacters,
		NO_RESTRICTIONS,
		STANDARD,
		townSizes,
		withRules,
		type GameMode,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import AddModeDialog from './AddModeDialog.svelte';
	import { allModes, customModes, findMode } from './custom-modes.svelte.ts';
	import { findRule } from './custom-rules.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';
	import ModeAbout from './ModeAbout.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ModeValue from './ModeValue.svelte';
	import ScriptPicker from './ScriptPicker.svelte';
	import RestrictedDialog from './RestrictedDialog.svelte';
	import SpecialRulesDialog from './SpecialRulesDialog.svelte';
	import { loadLinkedScript, loadScriptChoice, scriptChoices } from './script-choices.svelte.ts';
	import { campaigns } from './campaigns.ts';
	import { continueCampaign, startHref, startInMode, startTowns } from './start.ts';
	import { townGroup } from './town-groups.ts';
	import { townSetupHref } from './town-setup.ts';

	/**
	 * New game's Game modes area (Trevor, 2026-10-17: modes are their own area because they
	 * differ so much). Each mode shows only what it needs: a script where it plays one, a
	 * script per town where the Storyteller picks them, its own scripts where it has them, and
	 * none where it plays every character. Special rules stack on any mode, Standard too.
	 */
	interface Props {
		/**
		 * New game's own Standard game: script, players and Start (Grimoire board thread), given
		 * the special rules chosen.
		 */
		standard: Snippet<[readonly SpecialRule[]]>;
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
	/** The special rules chosen, in order (Trevor, 2026-10-18: rules stack on a mode). */
	let ruleIds = $state<string[]>([]);
	let choosingRules = $state(false);
	const rules = $derived(ruleIds.flatMap((id) => findRule(id) ?? []));
	/** The mode as it plays, with the rules folded in. */
	const played = $derived(withRules(mode, rules));
	const pool = $derived(played.parts.pool);
	const towns = $derived(played.parts.towns);
	let restrictions = $state(NO_RESTRICTIONS);
	// Role Recycling is the Storyteller's choice for a draft (Trevor, 2026-10-18); unset, the mode's own.
	let roleRecycling = $state<boolean | undefined>();
	const draft = $derived(
		played.parts.assignment?.kind === 'draft' ? played.parts.assignment : undefined
	);
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
	// Separate towns each need a full game's players (5 to 15); one town goes up to the
	// game's seat limit, like character selection (Trevor, 2026-10-18).
	const split = $derived(towns && !towns.samePlayers ? towns.count : 1);
	const minPlayers = $derived(MIN_PLAYERS * split);
	const maxPlayers = $derived(split > 1 ? MAX_PLAYERS * split : MAX_SEATS);
	const total = $derived(Math.min(maxPlayers, Math.max(minPlayers, players)));
	/**
	 * Separate towns each set their own count, with the setup sheet once per town (Trevor,
	 * 2026-10-19: "show the player count setup twice to account for the two different
	 * towns"); they start as the total split evenly.
	 */
	let townPlayers = $state<number[]>([]);
	const sizes = $derived(
		split > 1
			? townSizes(total, split).map((even, i) =>
					Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, townPlayers[i] ?? even))
				)
			: undefined
	);
	/** Towns further apart than the mode allows: a warning, never a lock. */
	const counts = $derived(played.parts.counts);
	const uneven = $derived(
		sizes &&
			counts?.kind === 'per-town' &&
			Math.max(...sizes) - Math.min(...sizes) > counts.maxDifference
			? counts.maxDifference
			: undefined
	);
	const restrictedCount = $derived(bannedIn(played, restrictions).size);

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
			restrictPool = modeCharacters(played, scriptCharacters, data.characters, {
				banned: [],
				allowed: played.parts.restricted?.banned ?? []
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
				await goto(
					startHref(modeId, readGameMode(open.game.gameId)?.rules ?? [], open.game.gameId)
				);
				return;
			}
			const loaded = await loadScripts(data);
			if (towns && towns.count > 1) {
				const groupId = await startTowns({
					modeId,
					rules,
					restrictions,
					data,
					scripts: loaded,
					sizes: sizes ?? Array.from({ length: towns.count }, () => total),
					create: (s, n) => OpenGame.create(data, s, n)
				});
				// Straight into town 1's setup; each bag built opens the next (Trevor, 2026-10-18).
				const group = townGroup(groupId);
				if (group) await goto(townSetupHref(group, 0, sizes?.[0] ?? total));
				else await goto(resolve('/towns/[groupId]', { groupId }));
				return;
			}
			const open = await startInMode({
				modeId,
				rules,
				restrictions,
				data,
				loaded: loaded[0],
				...(draft ? { roleRecycling: roleRecycling ?? draft.recycleUnchosen } : {}),
				create: (s) => OpenGame.create(data, s, total)
			});
			await goto(startHref(modeId, rules, open.game.gameId));
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
				roleRecycling = undefined;
				campaignId = 'new';
			}}
		/>
		<!-- Inspect and Add mode beside the drop-down they act on (Trevor, 2026-10-18). -->
		<IconButton
			icon="info"
			label={t('modes.inspect', { name: mode.name })}
			onclick={() => (inspecting = true)}
		/>
		<IconButton icon="add" label={t('modes.add.button')} onclick={() => (adding = true)} />
		<!-- Always there, so nothing moves; only a mode added on this device can go. -->
		<DeleteButton
			label={t('modes.add.delete', { name: mode.name })}
			disabled={!custom}
			onclick={() => (deleting = true)}
		/>
	</div>
	<!-- Every mode, Standard too: rules stack on any mode (Trevor, 2026-10-18), directly under
		the mode they stack on (2026-10-19). -->
	<Button variant="field" icon="fabled" onclick={() => (choosingRules = true)}>
		{t('modes.specialRulesButton', { count: rules.length })}
	</Button>
	<!-- Every mode's About, Standard's too (Trevor, 2026-10-18). -->
	<section class="about" aria-labelledby="mode-about-title">
		<h3 id="mode-about-title">{t('modes.about')}</h3>
		<ModeAbout {mode} compact />
	</section>

	{#if isStandard}
		{@render standard(rules)}
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
			<ScriptPicker label={t('modes.script')} value={script} onChange={(v) => (script = v)} />
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

		<!-- The same count and setup sheet as Standard (Trevor, 2026-10-18), once per town
			when the towns have their own players. -->
		{#if sizes}
			{#each sizes as count, i (i)}
				<PlayerCountSheet
					players={count}
					min={MIN_PLAYERS}
					max={MAX_PLAYERS}
					title={t('modes.townSheet', { number: i + 1 })}
					storageKey={`setup:sheet:town-${i + 1}`}
					testid={`town-${i + 1}-player-count`}
					onChange={(n) => (townPlayers[i] = n)}
				/>
			{/each}
			<!-- The warning's line is kept, so the page doesn't move when it shows. -->
			<p
				class="warn"
				class:shown={uneven !== undefined}
				role="status"
				data-testid="town-sizes-warning"
			>
				{t('modes.townsUneven', { count: uneven ?? 0 })}
			</p>
		{:else}
			<PlayerCountSheet
				players={total}
				min={minPlayers}
				max={maxPlayers}
				onChange={(n) => (players = n)}
			/>
		{/if}

		{#if draft}
			<Toggle
				label={t('modes.roleRecycling')}
				checked={roleRecycling ?? draft.recycleUnchosen}
				onChange={(on) => (roleRecycling = on)}
			/>
		{/if}
		<Button variant="field" icon="restricted" onclick={openRestricted}>
			{t('modes.restrictedButton', { count: restrictedCount })}
		</Button>
		<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}>
			{t('modes.start')}
		</Button>
	{/if}
</div>

<ModeInspectDialog bind:open={inspecting} {mode} />
<SpecialRulesDialog
	bind:open={choosingRules}
	{mode}
	{ruleIds}
	onChange={(ids) => (ruleIds = ids)}
	onadd={() => (adding = true)}
/>
<AddModeDialog
	bind:open={adding}
	onadded={(m) => {
		modeId = m.id;
		restrictions = NO_RESTRICTIONS;
	}}
	onaddedrule={(r) => (ruleIds = [...ruleIds.filter((id) => id !== r.id), r.id])}
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
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	/* The drop-down takes the row, the icon buttons their own size; a long mode name is cut
	   in the drop-down, never the page. */
	.pick {
		min-width: 0;
		display: flex;
		align-items: flex-end;
		gap: var(--space-1);
	}
	.pick > :global(:first-child) {
		flex: 1;
		min-width: 0;
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
	.warn {
		margin: 0;
		color: var(--evil);
		visibility: hidden;
	}
	.warn.shown {
		visibility: visible;
	}
</style>
