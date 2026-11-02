<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import { NEW_GAME_MAX_PLAYERS } from '#lib/features/setup/selection.svelte.ts';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		fromScript,
		toScript,
		type Character,
		type GameData,
		type LoadedScript,
		type Script
	} from '#lib/core/data/index.ts';
	import { MAX_PLAYERS, MAX_SEATS, MIN_PLAYERS } from '#lib/core/engine/index.ts';
	import {
		bannedIn,
		campaignRule,
		JINXED_PAIRS,
		modeCharacters,
		NO_RESTRICTIONS,
		STANDARD,
		townSizes,
		withRules,
		type GameMode,
		type JinxedPairs,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ScriptCopy from '#lib/features/player/ScriptCopy.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import AddModeDialog from './AddModeDialog.svelte';
	import { allModes, customModes, findMode } from './custom-modes.svelte.ts';
	import { findRule } from './custom-rules.svelte.ts';
	import ModeAbout from './ModeAbout.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ShareModeDialog from './ShareModeDialog.svelte';
	import { modeFileFromHash } from './mode-share.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ModeValue from './ModeValue.svelte';
	import ScriptPicker from './ScriptPicker.svelte';
	import RestrictedDialog from './RestrictedDialog.svelte';
	import {
		loadLinkedScript,
		loadScriptChoice,
		scriptChoices,
		type ScriptChoice
	} from './script-choices.svelte.ts';
	import { campaigns } from './campaigns.ts';
	import { switched, type SwitchChoices } from './rule-switches.ts';
	import { continueCampaign, rulesScript, setupHref, startInMode, startTowns } from './start.ts';
	import { townGroup } from './town-groups.ts';
	import { townSetupHref } from './town-setup.ts';
	import { storytellerName } from '#lib/features/game/storyteller-name.svelte.ts';
	import { openedByBack, readDraft, saveDraft } from './new-game-draft.ts';
	import { sheetRules } from './sheet-rules.ts';

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
		/** Standard's own screen, given the chosen rules and the Start game step that restates them. */
		standard: Snippet<[readonly SpecialRule[], (go: () => void) => void]>;
		/** The script Standard's own picker has chosen, for the preview. */
		standardScript: ScriptChoice;
		/** Standard's own player count, for the preview's Players breakdown. */
		standardPlayers: number;
		/** The mode chosen; New game sets it when the room votes on the mode (Trevor, 2026-10-23). */
		modeId?: string;
		/** The special rules chosen, in order; New game sets them when the room votes on them. */
		ruleIds?: string[];
	}

	let {
		standard,
		standardScript,
		standardPlayers,
		modeId = $bindable(STANDARD.id),
		ruleIds = $bindable([])
	}: Props = $props();
	/**
	 * Starts the game. The special rules are chosen on Character selection since 2026-10-29
	 * (Trevor), where they are restated; a room vote's rules still come with the game.
	 */
	function startKeepingDraft(go: () => void) {
		// Kept so Back from the next step brings New game back as it is now (Trevor, 2026-10-23).
		saveDraft(
			{
				modeId,
				ruleIds,
				switchChoices: { ...switchChoices },
				banned: restrictions.banned,
				allowed: restrictions.allowed,
				modePlayers: players,
				modeScript: script
			},
			true
		);
		go();
	}

	/**
	 * A shared mode link (mode-share.ts) opens Add mode holding its file, checked and confirmed
	 * like a pasted one. The hash is cleared so a refresh doesn't ask again.
	 */
	async function openSharedMode() {
		try {
			const file = await modeFileFromHash(location.hash);
			if (file === undefined) return;
			history.replaceState(history.state, '', location.pathname);
			addText = file;
			adding = true;
		} catch {
			history.replaceState(history.state, '', location.pathname);
			toast(t('modes.share.failed'));
		}
	}

	onMount(() => {
		void restoreScripts();
		void openSharedMode();
		if (!openedByBack()) return;
		const draft = readDraft();
		if (draft.modeId && findMode(draft.modeId)) modeId = draft.modeId;
		if (draft.ruleIds) ruleIds = draft.ruleIds.filter((id) => findRule(id));
		if (draft.switchChoices) switchChoices = draft.switchChoices;
		if (draft.banned || draft.allowed)
			restrictions = { banned: draft.banned ?? [], allowed: draft.allowed ?? [] };
		if (draft.modePlayers) players = draft.modePlayers;
		if (draft.modeScript) script = draft.modeScript;
	});

	// Standard first, then every mode (Trevor, 2026-10-18: one screen, modes in a drop-down).
	const modes = $derived([STANDARD, ...allModes().filter((m) => m.id !== STANDARD.id)]);
	const storyteller = $derived(storytellerName.current);
	const isStandard = $derived(modeId === STANDARD.id);
	const custom = $derived(customModes.list.some((m) => m.id === modeId));
	let adding = $state(false);
	let addText = $state('');
	let deleting = $state(false);
	let sharing = $state(false);
	const mode = $derived<GameMode>(findMode(modeId) ?? STANDARD);
	/** Rules whose own switch is on (rule-switches.ts), such as +1 naming its character. */
	let switchChoices = $state<SwitchChoices>({});
	const rules = $derived(
		ruleIds.flatMap((id) => findRule(id) ?? []).map((r) => switched(r, switchChoices))
	);
	/** The mode as it plays, with the rules folded in. */
	const played = $derived(withRules(mode, rules));
	const pool = $derived(played.parts.pool);
	const towns = $derived(played.parts.towns);
	let restrictions = $state(NO_RESTRICTIONS);
	// Role Recycling is the Storyteller's choice for a draft (Trevor, 2026-10-18); unset, the mode's own.
	let roleRecycling = $state<boolean | undefined>();
	let jinxedPairs = $state<JinxedPairs>('allow');
	let ivoryDraft = $state(false);
	let marionette = $state(false);
	let oneType = $state<boolean | undefined>();
	let dealsRequired = $state(true);
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
	// Separate towns each need a full game's players (5 to 15). One game goes up to 20, and
	// towns sharing their players up to the game's seat limit (Trevor, 2026-10-26).
	const split = $derived(towns && !towns.samePlayers ? towns.count : 1);
	const minPlayers = $derived(MIN_PLAYERS * split);
	const maxPlayers = $derived(
		split > 1 ? MAX_PLAYERS * split : (towns?.count ?? 1) > 1 ? MAX_SEATS : NEW_GAME_MAX_PLAYERS
	);
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

	// ── The script preview (Trevor, 2026-10-22): always open, showing the script as the game
	// will play it, with the mode's and the special rules' changes. ──
	const data = $derived(officialData.current);
	/** A mode's own town scripts, which load from their links. */
	let fixedLoaded = $state.raw<LoadedScript[]>([]);
	$effect(() => {
		const links = pool?.kind === 'per-town' ? pool.scripts : [];
		const d = data;
		if (!d || links.length === 0) return;
		let current = true;
		Promise.all(links.map((link) => loadLinkedScript(link, d)))
			.then((loaded) => current && (fixedLoaded = loaded))
			.catch(() => current && (fixedLoaded = []));
		return () => (current = false);
	});
	/** Each town's script as chosen, before the mode and rules change it. */
	const previewBases = $derived.by((): LoadedScript[] => {
		if (!data) return [];
		try {
			if (isStandard) return [loadScriptChoice(standardScript, data)];
			if (scriptKind === 'fixed') return fixedLoaded;
			if (scriptKind === 'per-town')
				return townScripts.slice(0, towns?.count ?? 2).map((c) => loadScriptChoice(c, data));
			return [loadScriptChoice(scriptKind === 'none' ? 'tb' : script, data)];
		} catch {
			return [];
		}
	});
	const previews = $derived.by((): LoadedScript[] => {
		if (!data) return [];
		const campaignScript: Script | undefined = continuing?.games[Number(versionValue)]?.script;
		const scripts = campaignScript
			? [campaignScript]
			: previewBases.map((loaded) =>
					rulesScript(played, toScript(loaded), loaded.characters, data, restrictions)
				);
		return scripts.map((s) => fromScript(s, data).script);
	});
	const previewPlayers = $derived(isStandard ? standardPlayers : (sizes?.[0] ?? total));

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
						create: (s) =>
							OpenGame.create(
								data,
								s,
								previous?.game.seating.length ?? total,
								undefined,
								undefined,
								storyteller
							)
					},
					(name, number) => t('modes.campaign.scriptName', { name, number })
				);
				await goto(setupHref(open.game.gameId));
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
					create: (s, n) => OpenGame.create(data, s, n, undefined, undefined, storyteller)
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
				...(draft
					? {
							roleRecycling: roleRecycling ?? draft.recycleUnchosen,
							jinxedPairs,
							ivoryDraft,
							marionette,
							oneTypePerOffer: oneType ?? draft.oneTypePerOffer,
							dealsRequired
						}
					: {}),
				create: (s) => OpenGame.create(data, s, total, undefined, undefined, storyteller)
			});
			saveDraft({ gameId: open.game.gameId });
			await goto(setupHref(open.game.gameId));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<!-- The settings, and the script preview beside them on a computer window, under them on a
	phone (Trevor, 2026-10-22). -->
<div class="new-game">
	<!-- Game mode, About, Game mode settings and Script each sit under the one PageSection
	header (Trevor, 2026-10-19: "should all share the common header"). -->
	<div class="modes">
		<PageSection title={t('modes.label')}>
			<div class="pick">
				<!-- One drop-down for the mode (Trevor, 2026-10-18: "a dropdown, not buttons"). -->
				<Select
					label={t('modes.label')}
					hideLabel
					value={modeId}
					options={modes.map((m) => ({ value: m.id, label: m.name }))}
					onChange={(v) => {
						modeId = v;
						restrictions = NO_RESTRICTIONS;
						roleRecycling = undefined;
						jinxedPairs = 'allow';
						ivoryDraft = false;
						marionette = false;
						oneType = undefined;
						dealsRequired = true;
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
				<!-- Always there, so nothing moves; only a mode added on this device can be shared
					(Trevor, 2026-10-31) or go. -->
				<IconButton
					icon="share"
					label={t('modes.shareFile', { name: mode.name })}
					disabled={!custom}
					onclick={() => (sharing = true)}
				/>
				<DeleteButton
					label={t('modes.add.delete', { name: mode.name })}
					disabled={!custom}
					onclick={() => (deleting = true)}
				/>
			</div>
		</PageSection>
		<!-- Every mode's About, Standard's too (Trevor, 2026-10-18). -->
		<PageSection title={t('modes.about')}>
			<ModeAbout {mode} compact />
		</PageSection>

		{#if isStandard}
			{@render standard(rules, startKeepingDraft)}
		{:else}
			<div class="settings" data-testid="mode-settings">
				<PageSection title={t('modes.settings')}>
					{#if ongoing.length > 0}
						<SettingSelect
							label={t('modes.campaign.choose')}
							description={t('modes.campaign.chooseHint')}
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
						<SettingSelect
							label={t('modes.campaign.version')}
							value={versionValue}
							options={versions}
							onChange={(v) => (version = v)}
						/>
					{/if}
					{#if draft}
						<SettingToggle
							label={t('modes.roleRecycling')}
							description={t('modes.roleRecyclingHint')}
							checked={roleRecycling ?? draft.recycleUnchosen}
							onChange={(on) => (roleRecycling = on)}
						/>
						<SettingSelect
							label={t('modes.jinxedPairs')}
							value={jinxedPairs}
							defaultValue="allow"
							options={JINXED_PAIRS.map((value) => ({
								value,
								label: t(`modes.jinxedPairs.${value}`)
							}))}
							onChange={(v) => (jinxedPairs = v)}
						/>
						<SettingToggle
							label={t('modes.ivoryDraft')}
							description={t('modes.ivoryDraftHint')}
							checked={ivoryDraft}
							onChange={(on) => (ivoryDraft = on)}
						/>
						<SettingToggle
							label={t('modes.marionette')}
							description={t('modes.marionetteHint')}
							checked={marionette}
							onChange={(on) => (marionette = on)}
						/>
						<SettingToggle
							label={t('modes.oneTypePerOffer')}
							description={t('modes.oneTypePerOfferHint')}
							checked={oneType ?? draft.oneTypePerOffer}
							onChange={(on) => (oneType = on)}
						/>
						<SettingToggle
							label={t('modes.dealsRequired')}
							description={t('modes.dealsRequiredHint')}
							checked={dealsRequired}
							onChange={(on) => (dealsRequired = on)}
						/>
					{/if}
					<div class="setting">
						<Button variant="field" icon="restricted" onclick={openRestricted}>
							{t('modes.restrictedButton')}
							<CountBadge count={restrictedCount} />
						</Button>
						<p class="description">{t('modes.restrictedHint')}</p>
					</div>
				</PageSection>
			</div>

			{#if continuing}
				<!-- The campaign's saved version is its script. -->
			{:else}
				<PageSection title={t('modes.script')}>
					{#if scriptKind === 'one'}
						<ScriptPicker
							label={t('modes.script')}
							hideLabel
							value={script}
							onChange={(v) => (script = v)}
						/>
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
				</PageSection>
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

			<Button
				variant="accent"
				icon="grimoire"
				disabled={starting}
				onclick={() => startKeepingDraft(start)}
			>
				{t('modes.start')}
			</Button>
		{/if}
	</div>

	<!-- Always open, never collapsed; it scrolls on its own beside the settings. -->
	<aside class="preview" aria-label={t('modes.preview')} data-testid="script-preview">
		<PageSection title={t('modes.preview')}>
			{#each previews as loaded, i (i)}
				{#if previews.length > 1}<h3 class="town">
						{t('modes.townScript', { number: i + 1 })}
					</h3>{/if}
				<!-- New game already shows the player counts beside the settings. -->
				<!-- The name above the author, as players see it (Trevor, 2026-10-24). -->
				<ScriptCopy
					script={loaded}
					players={previewPlayers}
					showBreakdown={false}
					title
					rules={sheetRules(mode, rules)}
				/>
			{:else}
				<p class="muted" aria-busy="true">{t('scripts.details.loading')}</p>
			{/each}
		</PageSection>
	</aside>
</div>

<ModeInspectDialog bind:open={inspecting} {mode} />
<AddModeDialog
	bind:open={adding}
	bind:text={addText}
	onadded={(m) => {
		modeId = m.id;
		restrictions = NO_RESTRICTIONS;
	}}
/>
<ShareModeDialog bind:open={sharing} mode={custom ? mode : undefined} />
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
	/* Each setting has its description under it, always there (Trevor, 2026-10-19). */
	.setting {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-3);
	}
	/* The thin line between settings, as SettingRow draws it; none under the heading. */
	.setting {
		border-top: 1px solid var(--border);
	}
	.setting:first-child {
		border-top: 0;
	}
	.description {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	.modes {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-3);
	}
	.new-game {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
	}
	.town {
		margin: var(--space-3) 0 0;
	}
	/* Rows of the preview are ruled apart, as stacked rows are elsewhere (Trevor, 2026-10-22). */
	.preview :global(li.character) {
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}
	/* A computer window: the preview sits to the right and scrolls on its own, held at the
	   top of the screen as Page's side column is. */
	@media (min-width: 75rem) {
		.new-game {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}
		.preview {
			position: sticky;
			top: calc(var(--app-top) + var(--space-2));
			max-height: calc(100dvh - var(--app-top) - var(--space-4));
			overflow-y: auto;
			padding-bottom: var(--space-4);
		}
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
		color: var(--evil-text);
		visibility: hidden;
	}
	.warn.shown {
		visibility: visible;
	}
</style>
