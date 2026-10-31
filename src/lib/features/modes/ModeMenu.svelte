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
	import { gameClock, optionalRuleChoices } from '#lib/core/rules/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { editionWikiUrl, fromScript, scriptEdition, scriptToJson } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { downloadJson, fileNameFor } from '#lib/ui/download.ts';
	import { campaignOf } from './campaigns.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';
	import { seedInPlay } from './in-play.ts';
	import GameInfoSheet, { type GameInfoRow } from './GameInfoSheet.svelte';
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
		/**
		 * The Storyteller's own board: each row has an eye for the corner. The Storyteller's name
		 * is the Profile's, renamed only there (Trevor, 2026-10-30).
		 */
		editable?: boolean;
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
		editable = false,
		startedAt,
		endedAt,
		phase,
		watcherCount = 0,
		onShare
	}: Props = $props();
	const gameId = $derived(game.gameId);

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
	// Each character's optional rule, in play or not (Trevor, 2026-10-31).
	const optional = $derived.by(() => {
		const lookup = characters?.();
		if (!lookup) return { on: [], off: [] };
		const named = optionalRuleChoices(game, lookup).map((r) => ({
			...r,
			// eslint-disable-next-line grim/names-as-badges -- a Game info value is plain text, as the special rules row's names are
			name: lookup.get(r.characterId)?.name ?? r.characterId
		}));
		return {
			on: named.filter((r) => r.on).map((r) => r.name),
			off: named.filter((r) => !r.on).map((r) => r.name)
		};
	});
	const info = $derived<GameInfoRow[]>([
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
		{
			key: 'mode',
			label: t('modes.label'),
			value: (base ?? STANDARD).name,
			links: base ? [inspectLink(base)] : undefined
		},
		{
			key: 'rules',
			label: t('modes.info.rules'),
			value: rules.map((r) => r.name).join(', '),
			links: rules.map(inspectLink)
		},
		{
			key: 'optional-rules',
			label: t('modes.optionalRules'),
			value: optional.on.join(', ') || undefined,
			extra:
				optional.off.length > 0
					? t('modes.optionalRulesOff', { names: optional.off.join(', ') })
					: undefined
		},
		...(onShare
			? [
					{
						key: 'join-code',
						label: t('room.joinCode'),
						value: roomCode ? formatRoomCode(roomCode) : undefined,
						// Opens Share, as the corner's does; before a room opens it is None and
						// opens Share to start one.
						action: onShare,
						actionTestId: 'info-join-code'
					}
				]
			: []),
		// The game phase and the length, each a line with its own eye (Trevor, 2026-10-26).
		{ key: 'phase', label: t('modes.info.phase'), value: phase },
		{
			key: 'game-time',
			label: t('history.gameLength'),
			// 0:00 until the first night, as on the corner: Game phase says Setup (Trevor,
			// 2026-10-26: "game time should no longer say setup").
			value: gameLength ?? (phase === t('day.setup') ? gameClock.formatGameLength(0) : undefined)
		},
		{
			key: 'watchers',
			label: t('modes.info.watchers'),
			value: watcherCount > 0 ? String(watcherCount) : undefined
		}
	]);
	/** A row's eye, when it has one: every row but the script's name, which opens Game info. */
	const lineOf = (key: string) =>
		editable ? CORNER_LINES.find((line): line is CornerLine => line === key) : undefined;
	function toggleLine(line: CornerLine) {
		const lines = preferences.current.cornerLines;
		preferences.update({ cornerLines: { ...lines, [line]: !lines[line] } });
	}
	const campaign = $derived(campaignOf(gameId));
	const specters = $derived(hasSpectatorVote(gameId));
	const assignment = $derived(mode?.parts.assignment?.kind);
	const hidden = $derived(mode?.parts.pool?.kind === 'script-plus-hidden');
	let inspecting = $state(false);
	let spectating = $state(false);
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

	/** The mode and each rule open their whole Inspect when tapped (plan G5). */
	function inspectLink(item: GameMode | SpecialRule) {
		return {
			id: item.id,
			name: item.name,
			label: t('modes.inspect', { name: item.name }),
			onclick: () => inspect(item)
		};
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

	function go(path: Parameters<typeof goto>[0]) {
		open = false;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- every caller passes a resolved path
		void goto(path);
	}
</script>

<!-- Whether the board's corner shows this line (Trevor, 2026-10-24: "an eye toggle on each
     line in game info"); a tap target over the row's height. -->
{#snippet eye(row: GameInfoRow)}
	{@const line = lineOf(row.key)}
	{#if line}{@const shown = preferences.current.cornerLines[line]}<button
			type="button"
			class="inline-icon eye"
			aria-pressed={shown}
			aria-label={t('modes.info.onBoard', { line: cornerLineLabel(line) })}
			data-testid="corner-eye"
			onclick={() => toggleLine(line)}><Icon name={shown ? 'show' : 'hide'} /></button
		>{/if}
{/snippet}
{#snippet after(row: GameInfoRow)}
	{#if row.key === 'script'}<!-- The file beside the script's name, whose link is its source
		(Trevor, 2026-10-27: no buttons atop Game info). --><button
			type="button"
			class="inline-icon after"
			aria-label={t('modes.info.download')}
			data-testid="game-info-download"
			onclick={() => void downloadScript()}><Icon name="download" /></button
		>{/if}
{/snippet}
{#snippet actions()}
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
{/snippet}
<GameInfoSheet
	bind:open
	rows={info}
	{children}
	lead={editable ? eye : undefined}
	{after}
	footer={actions}
/>
{#if inspected}<ModeInspectDialog bind:open={inspecting} mode={inspected} />{/if}
{#if specters && mode}<SpectersSheet bind:open={spectating} {game} {mode} />{/if}

<style>
	/* Icon-sized in the row, so Game info keeps its height; the ::before is its tap target.
	   The eyes, the script's download and the Storyteller's pencil. */
	.inline-icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 0;
		height: 1lh;
		padding: 0;
		vertical-align: top;
		border: 0;
		background: none;
		color: inherit;
		/* The row's own text size, so its line (1lh) is the row's and the eye sits level with
		   its label (Trevor, 2026-10-26: "slightly higher than the thing they identify with"). */
		font: inherit;
		cursor: pointer;
	}
	/* Within the text's line, so the row keeps its height; the icon's own box with it, so the
	   eye is centred in the line rather than spilling above it. */
	.inline-icon :global(.icon),
	.inline-icon :global(svg) {
		width: 1.1em;
		height: 1.1em;
	}
	.eye {
		color: var(--on-surface-muted);
	}
	.inline-icon.after {
		margin-left: var(--space-2);
	}
	.eye[aria-pressed='true'] {
		color: var(--heading);
	}
	.inline-icon::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		transform: translate(-50%, -50%);
	}
</style>
