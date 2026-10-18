<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { inPlayFor, STANDARD } from '#lib/core/modes/index.ts';
	import { setupComplete } from '#lib/core/rules/bag-plan.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { findMode } from './custom-modes.svelte.ts';
	import { seedInPlay } from './in-play.ts';
	import { townGroupOf } from './town-groups.ts';

	/**
	 * The town switcher on the board's corner script name (Trevor, 2026-10-18: not in the
	 * toolbar, since most games have no towns). A game that is not a town shows the name
	 * unchanged; a town's name opens its towns, picked as the towns page's Open town does.
	 */
	interface Props {
		gameId: string;
		children: Snippet;
	}

	let { gameId, children }: Props = $props();

	const group = $derived(townGroupOf(gameId));
	let open = $state(false);
	let anchor = $state<HTMLElement>();
	let towns = $state.raw<(OpenGame | undefined)[]>([]);

	async function show() {
		if (!group) return;
		open = true;
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
		const mode = findMode(group?.modeId ?? '') ?? STANDARD;
		seedInPlay(town.game.gameId, town.game.seating.length, inPlayFor(mode, i));
		const id = town.game.gameId;
		void goto(
			setupComplete(town.game)
				? resolve('/grimoire/[gameId]', { gameId: id })
				: resolve('/grimoire/[gameId]/setup', { gameId: id })
		);
	}
</script>

{#if group}
	<button
		type="button"
		class="name"
		bind:this={anchor}
		aria-haspopup="dialog"
		aria-expanded={open}
		data-testid="town-switch"
		onclick={() => void show()}>{@render children()}<Icon name="expand" /></button
	>
	<Popover bind:open title={t('modes.towns.switch')} {anchor}>
		<div class="towns">
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
				onclick={() => {
					open = false;
					if (group) void goto(resolve('/towns/[groupId]', { groupId: group.groupId }));
				}}
			>
				{t('modes.towns.all')}
			</Button>
		</div>
	</Popover>
{:else}
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
	.towns {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.towns :global(button),
	.towns :global(a) {
		justify-content: flex-start;
	}
</style>
