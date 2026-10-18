<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { Game } from '#lib/core/model/index.ts';
	import { inPlayFor, STANDARD } from '#lib/core/modes/index.ts';
	import { setupComplete } from '#lib/core/rules/bag-plan.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { campaignOf } from './campaigns.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';
	import { seedInPlay } from './in-play.ts';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import { hasSpectatorVote } from './specters.ts';
	import SpectersSheet from './SpectersSheet.svelte';
	import { townGroupOf } from './town-groups.ts';

	/**
	 * A game mode's own actions, on the board's corner script name (Trevor, 2026-10-18: one
	 * "Game modes" place for any special actions, not in the toolbar, since most games have
	 * no mode). A Standard game shows the name unchanged. A mode's name opens its towns
	 * (picked as the towns page's Open town does), campaign, Specters vote, hidden
	 * characters or draft, and Inspect.
	 */
	interface Props {
		game: Game;
		/** The corner name, which opens the menu; without it the menu is a dialog opened by `open` (the board's ⋯, when the corner has no room for the name). */
		children?: Snippet;
		open?: boolean;
	}

	let { game, children, open = $bindable(false) }: Props = $props();
	const gameId = $derived(game.gameId);

	const group = $derived(townGroupOf(gameId));
	const mode = $derived.by(() => {
		const id = readGameMode(gameId)?.modeId;
		const found = id ? findMode(id) : undefined;
		return found && found.id !== STANDARD.id ? found : undefined;
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

	function go(path: Parameters<typeof goto>[0]) {
		open = false;
		void goto(path);
	}
</script>

{#if mode}
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
					onclick={() =>
						go(resolve('/campaigns/[campaignId]', { campaignId: campaign.campaignId }))}
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
				<Button
					variant="quiet"
					icon="random"
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
			<Button
				variant="quiet"
				icon="info"
				onclick={() => {
					open = false;
					inspecting = true;
				}}
			>
				{t('modes.inspect', { name: mode.name })}
			</Button>
		</div>
	{/snippet}
	{#if children}
		<Popover bind:open title={t('modes.label')} {anchor}>{@render actions()}</Popover>
	{:else}
		<Dialog bind:open title={t('modes.label')}>{@render actions()}</Dialog>
	{/if}
	<ModeInspectDialog bind:open={inspecting} {mode} />
	{#if specters}<SpectersSheet bind:open={spectating} {game} {mode} />{/if}
{:else if children}
	{@render children()}
{/if}

<style>
	/* The name keeps its size and place; only the caret is added, inside the same line. */
	.name {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.2em;
		min-width: 0;
		max-width: 100%;
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
