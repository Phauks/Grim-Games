<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { setupAlignmentTasks, type SetupAlignmentTask } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import type { ShownInfoCard } from '#lib/features/show/shown.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * The first night's Starting alignment step (M22): for each setup change that makes players
	 * start with the other alignment (the Bounty Hunter's evil Townsfolk,
	 * https://wiki.bloodontheclocktower.com/Bounty_Hunter), the players who fit, each with Show
	 * to player, since players know their own alignment
	 * (https://wiki.bloodontheclocktower.com/Glossary). While too few fit, Choose picks one;
	 * any player can be chosen, the usual type first (warn, never lock).
	 */
	interface Props {
		grimoire: Grimoire;
		onShow: (card: ShownInfoCard) => void;
	}

	let { grimoire, onShow }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	// Worked out live, not from the step: the open step is kept as it was when opened, and a
	// player picked here must show at once.
	const tasks = $derived(setupAlignmentTasks(game, characters));

	let choosing = $state<SetupAlignmentTask | undefined>();
	let chooserOpen = $state(false);
	const misfits = $derived(
		new Set(game.seating.filter((s) => choosing && !choosing.candidates.includes(s)))
	);

	function choose(seatId: SeatId) {
		if (choosing) grimoire.run({ type: 'SetAlignment', seatId, alignment: choosing.alignment });
		chooserOpen = false;
		choosing = undefined;
	}

	function show(seatId: SeatId, task: SetupAlignmentTask) {
		const id = game.seats[seatId]?.characterId;
		const character = id ? characters.get(id) : undefined;
		onShow({
			title: 'You are',
			...(character ? { characters: [{ character, alignment: task.alignment }] } : {})
		});
	}
</script>

<ul class="tasks" data-testid="setup-alignment">
	{#each tasks as task (`${task.characterId}:${task.type}:${task.alignment}`)}
		{@const source = characters.get(task.characterId)}
		<li>
			<p class="head">
				<CharacterBadge characterId={task.characterId} character={source} />: {task.summary}
			</p>
			<ul class="seats">
				{#each task.seats as seatId (seatId)}
					{@const id = game.seats[seatId]?.characterId}
					<li>
						{#if id}
							<CharacterBadge
								characterId={id}
								character={characters.get(id)}
								alignment={task.alignment}
								playerName={seatName(game, seatId)}
							/>
						{/if}
						<span class="spacer"></span>
						<Button variant="quiet" icon="showToPlayer" onclick={() => show(seatId, task)}
							>Show to player</Button
						>
					</li>
				{/each}
				{#if !task.done}
					<li>
						<span class="none">None</span>
						<span class="spacer"></span>
						<Button
							variant="quiet"
							onclick={() => {
								choosing = task;
								chooserOpen = true;
							}}>Choose</Button
						>
					</li>
				{/if}
			</ul>
		</li>
	{/each}
</ul>

<SeatChooser
	bind:open={chooserOpen}
	title={choosing ? `Make ${choosing.alignment}` : 'Make'}
	{game}
	{characters}
	{misfits}
	onChoose={choose}
/>

<style>
	.tasks,
	.seats {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.head {
		margin: 0;
	}
	.seats li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.spacer {
		flex: 1;
	}
</style>
