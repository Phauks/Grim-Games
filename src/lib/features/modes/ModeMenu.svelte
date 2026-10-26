<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { Game } from '#lib/core/model/index.ts';
	import {
		inPlayFor,
		STANDARD,
		withRules,
		type GameMode,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import { setupComplete } from '#lib/core/rules/bag-plan.ts';
	import { gameClock } from '#lib/core/rules/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { editionWikiUrl, fromScript, scriptEdition, scriptToJson } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { onLayerOpen } from '#lib/ui/primitives/layers.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { downloadJson, fileNameFor } from '#lib/ui/download.ts';
	import { campaignOf } from './campaigns.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';
	import { seedInPlay } from './in-play.ts';
	import GameInfoEditDialog, { type GameInfoChanges } from './GameInfoEditDialog.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import { hasSpectatorVote } from './specters.ts';
	import SpectersSheet from './SpectersSheet.svelte';
	import { townGroupOf } from './town-groups.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import { contextCharacters } from '#lib/features/characters/character-context.ts';
	import { playersLine, ruleCharactersLine } from './players-line.ts';
	import { savedChoiceFor } from './script-choices.svelte.ts';
	import { cornerLineLabel } from './corner-line-labels.ts';
	import { CORNER_LINES, type CornerLine } from '#lib/ui/corner-lines.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { sourcePage } from '#lib/features/scripts/saved-scripts.ts';

	/**
	 * The game's info and a game mode's own actions, on the board's corner script name (Trevor,
	 * 2026-10-18: one "Game modes" place for any special actions, not in the toolbar). Every
	 * game, Standard too, shows its script, author, version, Storyteller, mode and special
	 * rules (Trevor, 2026-10-19: "even in normal mode, to get the various info on the game").
	 * A mode adds its towns (picked as the towns page's Open town does), campaign, Specters
	 * vote, hidden characters or draft, and Inspect for the mode and each special rule.
	 */
	interface Props {
		game: Game;
		/** The corner name, which opens the menu; without it the menu is a dialog opened by `open` (the board's ⋯, while the corner name is hidden). */
		children?: Snippet;
		open?: boolean;
		/** Renames the Storyteller: their row is then tappable (Trevor, 2026-10-19: "edit storyteller name in bottom left"). */
		/** Saves the Game info pencil's changes; without it Game info has no pencil. */
		onEdit?: (changes: GameInfoChanges) => void;
		/**
		 * The board corner's other lines, so Game info has all of them where the corner can't
		 * show them (Trevor, 2026-10-23: "on mobile I can't see the join code or game time").
		 * When the game started and ended, for Game time.
		 */
		startedAt?: number;
		endedAt?: number;
		/** The night or day in play, as the corner shows it ("Setup", "Night 2", "Day 1"). */
		phase?: string;
		/** Spectators on the view-only link. */
		watcherCount?: number;
		/** The join code opens Share; without it (a spectator's board) there is no join code row. */
		onShare?: () => void;
	}

	let {
		game,
		children,
		open = $bindable(false),
		onEdit,
		startedAt,
		endedAt,
		phase,
		watcherCount = 0,
		onShare
	}: Props = $props();
	let editing = $state(false);
	const gameId = $derived(game.gameId);
	// The corner's popover closes when a seat's sheet or another overlay opens over the board
	// (Trevor, 2026-10-19: "Game info popup should close if other item is opened like a
	// character"). The ⋯ dialog is an overlay itself, so it isn't closed this way.
	$effect(() => {
		if (open && children) return onLayerOpen(() => (open = false));
	});

	const group = $derived(townGroupOf(gameId));
	const record = $derived(readGameMode(gameId));
	/** The mode itself, when it isn't Standard. */
	const base = $derived.by(() => {
		const found = record ? findMode(record.modeId) : undefined;
		return found && found.id !== STANDARD.id ? found : undefined;
	});
	const rules = $derived(record?.rules ?? []);
	/** The mode as it plays, with its rules; undefined for a Standard game with none. */
	const mode = $derived(base || rules.length ? withRules(base ?? STANDARD, rules) : undefined);
	let inspected = $state<GameMode | SpecialRule>();
	// The board's character lookup, to count the characters in play by type.
	const characters = contextCharacters();
	const none = $derived(t('common.none'));
	// The saved script the game started from: its name links its source page, and its version
	// shows when the game's own script names none (Trevor, backlog L14).
	const savedChoice = $derived(savedChoiceFor(game.script));
	const scriptPage = $derived(
		(savedChoice?.source && sourcePage(savedChoice.source)) ??
			editionWikiUrl(scriptEdition(game.script)?.id)
	);
	const roomCode = $derived(roomHost().code);
	/** Game time ticks while the sheet is open, as the corner's does. */
	let clockNow = $state(Date.now());
	$effect(() => {
		if (!open || startedAt === undefined || endedAt !== undefined) return;
		clockNow = Date.now();
		const tick = setInterval(() => (clockNow = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	const gameLength = $derived(
		startedAt === undefined
			? undefined
			: gameClock.formatGameLength(gameClock.gameLength(startedAt, clockNow, endedAt))
	);
	const info = $derived([
		{
			key: 'script',
			label: t('modes.info.script'),
			value: game.script.meta?.name,
			href: scriptPage
		},
		{ key: 'author', label: t('modes.info.author'), value: game.script.meta?.author },
		{
			key: 'version',
			label: t('modes.info.version'),
			value: scriptVersion(undefined, game.script.meta) ?? savedChoice?.version
		},
		{ key: 'storyteller', label: t('modes.info.storyteller'), value: game.storytellerName },
		{
			key: 'players',
			label: t('modes.info.players'),
			value: playersLine(game, characters?.()),
			// Not players, so on a line of their own (Trevor, 2026-10-20).
			extra: ruleCharactersLine(game, characters?.())
		},
		{ key: 'mode', label: t('modes.label'), value: (base ?? STANDARD).name },
		{
			key: 'rules',
			label: t('modes.info.rules'),
			value: rules.map((r) => r.name).join(', ')
		},
		...(onShare
			? [
					{
						key: 'join-code',
						label: t('room.joinCode'),
						value: roomCode ? formatRoomCode(roomCode) : undefined,
						action: onShare
					}
				]
			: []),
		// The day or night before the length, as on the corner's line (Trevor, 2026-10-24).
		{
			key: 'game-time',
			label: t('history.gameLength'),
			value: phase && gameLength ? `${phase} · ${gameLength}` : (phase ?? gameLength)
		},
		{
			key: 'watchers',
			label: t('modes.info.watchers'),
			value: watcherCount > 0 ? String(watcherCount) : undefined
		}
	]);
	/** A row's eye, when it has one: every row but the script's name, which opens Game info. */
	const lineOf = (key: string) =>
		onEdit ? CORNER_LINES.find((line): line is CornerLine => line === key) : undefined;
	function toggleLine(line: CornerLine) {
		const lines = preferences.current.cornerLines;
		preferences.update({ cornerLines: { ...lines, [line]: !lines[line] } });
	}
	/** What the mode and rules rows open when tapped: each one's whole Inspect (plan G5). */
	const inspectable = $derived<Record<string, readonly (GameMode | SpecialRule)[]>>({
		mode: base ? [base] : [],
		rules
	});
	const campaign = $derived(campaignOf(gameId));
	const specters = $derived(hasSpectatorVote(gameId));
	const assignment = $derived(mode?.parts.assignment?.kind);
	const hidden = $derived(mode?.parts.pool?.kind === 'script-plus-hidden');
	let inspecting = $state(false);
	let spectating = $state(false);
	let anchor = $state<HTMLElement>();
	let towns = $state.raw<(OpenGame | undefined)[]>([]);

	$effect(() => {
		if (open) void loadTowns();
	});

	async function loadTowns() {
		if (!group) return;
		try {
			const data = await loadOfficialData();
			towns = await Promise.all(group.gameIds.map((id) => OpenGame.open(data, id)));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	}

	function pick(town: OpenGame, i: number) {
		open = false;
		if (town.game.gameId === gameId) return;
		seedInPlay(
			town.game.gameId,
			town.game.seating.length,
			inPlayFor(findMode(group?.modeId ?? '') ?? STANDARD, i)
		);
		const id = town.game.gameId;
		void goto(
			setupComplete(town.game)
				? resolve('/grimoire/[gameId]', { gameId: id })
				: resolve('/grimoire/[gameId]/setup', { gameId: id })
		);
	}

	function inspect(item: GameMode | SpecialRule) {
		open = false;
		inspected = item;
		inspecting = true;
	}

	/** The game's script as a file in TPI's format (Trevor, 2026-10-22, plan G3). */
	async function downloadScript() {
		try {
			const data = await loadOfficialData();
			const name = game.script.meta?.name ?? '';
			downloadJson(fileNameFor(name, 'script'), scriptToJson(fromScript(game.script, data).script));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	}

	/**
	 * Where the script came from, on the one share screen (plan G3; Trevor, 2026-10-23: every
	 * Share the same), with its QR code, Copy and Share.
	 */
	let sharingSource = $state(false);
	const sourceTitle = $derived(game.script.meta?.name ?? t('modes.info.script'));

	function go(path: Parameters<typeof goto>[0]) {
		open = false;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- every caller passes a resolved path
		void goto(path);
	}
</script>

{#if children}<button
		type="button"
		class="name"
		bind:this={anchor}
		aria-haspopup="dialog"
		aria-expanded={open}
		data-testid="mode-menu"
		onclick={() => (open = true)}>{@render children()}<Icon name="expand" /></button
	>{/if}
{#snippet actions()}
	<table class="info" data-testid="game-info">
		<tbody>
			{#each info as row (row.key)}
				{@const line = lineOf(row.key)}
				<tr data-field={row.key}>
					<!-- Whether the board's corner shows this line (Trevor, 2026-10-24: "an eye
					     toggle on each line in game info"); a tap target over the row's height. -->
					{#if onEdit}<td class="eye-cell"
							>{#if line}{@const shown = preferences.current.cornerLines[line]}<button
									type="button"
									class="eye"
									aria-pressed={shown}
									aria-label={t('modes.info.onBoard', { line: cornerLineLabel(line) })}
									data-testid="corner-eye"
									onclick={() => toggleLine(line)}><Icon name={shown ? 'show' : 'hide'} /></button
								>{/if}</td
						>{/if}
					<th scope="row">{row.label}</th>
					<td>
						{#if inspectable[row.key]?.length}<!-- Tapped for its full details (Trevor,
							2026-10-22: "allow clicking game mode or special rules in game info to see
							exact details"). -->{#each inspectable[row.key] as item, i (item.id)}{#if i > 0},
								{/if}<button
									type="button"
									class="inspect-link"
									aria-label={t('modes.inspect', { name: item.name })}
									onclick={() => inspect(item)}>{item.name}</button
								>{/each}{:else if 'action' in row && row.action}<!-- The join code opens
							Share, as the corner's does; before a room opens it is None and opens Share
							to start one. --><button
								type="button"
								class="inspect-link"
								data-testid="info-join-code"
								onclick={() => {
									open = false;
									row.action?.();
								}}>{row.value || none}</button
							>{:else if 'href' in row && row.href && row.value?.trim()}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- another site's page -->
							<a href={row.href} target="_blank" rel="noopener noreferrer">{row.value}</a
							>{:else}{row.value?.trim() || none}{/if}{#if 'extra' in row && row.extra}<span
								class="extra"
								data-testid="info-extra">{row.extra}</span
							>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="actions">
		{#if group}
			{#each group.gameIds as id, i (id)}
				{@const town = towns[i]}
				<Button
					variant="quiet"
					icon={id === gameId ? 'check' : undefined}
					disabled={!town}
					aria-current={id === gameId ? 'page' : undefined}
					onclick={() => town && pick(town, i)}
				>
					{t('modes.towns.townScript', {
						number: i + 1,
						script: town?.game.script.meta?.name ?? t('common.none')
					})}
				</Button>
			{/each}
			<Button
				variant="quiet"
				icon="grimoire"
				onclick={() => go(resolve('/towns/[groupId]', { groupId: group.groupId }))}
			>
				{t('modes.towns.all')}
			</Button>
		{/if}
		{#if campaign}
			<Button
				variant="quiet"
				icon="history"
				onclick={() => go(resolve('/campaigns/[campaignId]', { campaignId: campaign.campaignId }))}
			>
				{t('library.campaignOpen')}
			</Button>
		{/if}
		{#if specters}
			<Button
				variant="quiet"
				icon="vote"
				onclick={() => {
					open = false;
					spectating = true;
				}}
			>
				{t('modes.specters.menu')}
			</Button>
		{/if}
		{#if hidden}
			<!-- A gear, as it opens settings for the rules; the shuffle read as "randomise" (Trevor, 2026-10-25). -->
			<Button
				variant="quiet"
				icon="settings"
				onclick={() => go(resolve('/grimoire/[gameId]/extras', { gameId }))}
			>
				{t('modes.extras.title')}
			</Button>
		{/if}
		{#if assignment === 'draft' || assignment === 'choose-own'}
			<Button
				variant="quiet"
				icon="bag"
				onclick={() => go(resolve('/grimoire/[gameId]/deal', { gameId }))}
			>
				{t('modes.deal.menu')}
			</Button>
		{/if}
	</div>
{/snippet}
{#snippet edit()}
	<!-- Share and download sit with Edit in the header, so the script's name has its line to
	     itself (Trevor, 2026-10-23: the name sat oddly beside an inline button). -->
	<IconButton
		icon="share"
		label={t('modes.info.shareSource')}
		title={scriptPage ? t('modes.info.shareSource') : t('modes.info.noSource')}
		disabled={!scriptPage}
		data-testid="share-source"
		onclick={() => {
			open = false;
			sharingSource = true;
		}}
	/>
	<IconButton
		icon="download"
		label={t('modes.info.download')}
		data-testid="game-info-download"
		onclick={() => void downloadScript()}
	/>
	<!-- New game is in the board's ⋯ menu (Trevor, 2026-10-26), not here. -->
	{#if onEdit}<IconButton
			icon="edit"
			label={t('modes.info.edit')}
			data-testid="game-info-edit"
			onclick={() => {
				open = false;
				editing = true;
			}}
		/>{/if}
{/snippet}
{#if children}
	<Popover bind:open title={t('modes.info.title')} {anchor} headActions={edit}
		>{@render actions()}</Popover
	>
{:else}
	<Dialog bind:open title={t('modes.info.title')} headActions={edit}>{@render actions()}</Dialog>
{/if}
{#if onEdit}
	<GameInfoEditDialog
		bind:open={editing}
		initial={{ storytellerName: game.storytellerName ?? '' }}
		onsave={onEdit}
	/>
{/if}
<Dialog bind:open={sharingSource} title={t('scripts.share.title', { title: sourceTitle })}>
	<div class="share-source">
		<SharePanel
			url={scriptPage}
			title={sourceTitle}
			qrLabel={t('modes.info.sourceQr')}
			pending={t('modes.info.noSource')}
		/>
	</div>
</Dialog>
{#if inspected}<ModeInspectDialog bind:open={inspecting} mode={inspected} />{/if}
{#if specters && mode}<SpectersSheet bind:open={spectating} {game} {mode} />{/if}

<style>
	.share-source {
		margin-top: var(--space-3);
	}
	.extra {
		display: block;
	}
	/* The name keeps its size and place; only the caret is added, inside the same line. */
	.name {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.2em;
		min-width: 0;
		max-width: 100%;
		/* Text high, not a button's 44px: the corner's room is measured from its height
		   (corner-room.ts); the ::before below keeps the tap target. */
		min-height: 0;
		padding: 0;
		/* The corner title lets taps through to the board; its town name takes them. */
		pointer-events: auto;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
		--icon-size: 0.9em;
	}
	/* The name is cut short as the corner title cuts it; the caret always shows. */
	.name > :global(:first-child) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name > :global(:last-child) {
		flex: none;
	}
	/* A tap target bigger than the small corner text, without moving anything. */
	.name::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
	.info {
		border-collapse: collapse;
		margin-top: var(--space-2);
	}
	.eye-cell {
		padding-right: var(--space-2);
	}
	/* Icon-sized in the row, so Game info keeps its height; the ::before is its tap target. */
	.eye {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 0;
		height: 1lh;
		padding: 0;
		vertical-align: top;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		cursor: pointer;
	}
	/* Within the text's line, so the row keeps its height. */
	.eye :global(svg) {
		width: 1.1em;
		height: 1.1em;
	}
	.eye[aria-pressed='true'] {
		color: var(--heading);
	}
	.eye::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		transform: translate(-50%, -50%);
	}
	.info th {
		padding-right: var(--space-3);
		color: var(--on-surface-muted);
		font-weight: normal;
		text-align: left;
		white-space: nowrap;
	}
	.info th,
	.info td {
		padding-block: var(--space-1);
		vertical-align: top;
	}
	/* The mode and each rule read as text and open their details; the tap target is
	   widened without moving the row, as the corner name's is. */
	.inspect-link {
		position: relative;
		/* Inline in the row like the script's link; the ::before below is its tap target. */
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font: inherit;
		text-align: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.inspect-link::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
	/* The Storyteller's row is a button: its name, tapped to rename them. */
	.actions:empty {
		display: none;
	}
	.actions {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.actions :global(button),
	.actions :global(a) {
		justify-content: flex-start;
	}
</style>
