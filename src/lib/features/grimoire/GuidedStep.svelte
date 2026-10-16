<script lang="ts">
	import StepIcon from './StepIcon.svelte';
	import NightAlerts from './NightAlerts.svelte';
	import NightSuggested from './NightSuggested.svelte';
	import TravellerAlignment from './TravellerAlignment.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { TRAVELLER_ALIGNMENT_STEP } from '#lib/core/rules/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { Night, NightStep } from '#lib/core/rules/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import NightText from '#lib/features/reference/NightText.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName, stepHolders, stepName } from './night-steps.ts';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';

	/**
	 * One night step, filled in with help (Trevor, 2026-10-16): TPI's text, who has the
	 * character, its reminders to place or move onto a chosen seat, and Show to player.
	 * Nothing happens unless the Storyteller taps it; Done ticks the step.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		step: NightStep | undefined;
		night: Night;
		/** Info tokens, for the steps that show the player something. */
		onInfoTokens: () => void;
		/** A Traveller's alignment by draw. */
		onDraw: (seatId: string) => void;
	}

	let { open = $bindable(), grimoire, step, night, onInfoTokens, onDraw }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const holders = $derived(step ? stepHolders(game, step, characters) : []);
	/** The character's own reminder tokens, each once (copies are placed one at a time). */
	const labels = $derived(step?.character ? [...new Set(step.character.reminders)] : []);
	/** Where each label already is on the board, if anywhere. */
	function placed(label: string) {
		for (const seatId of game.seating) {
			const r = game.seats[seatId].reminders.find(
				(x) => x.characterId === step?.character?.id && x.label === label
			);
			if (r) return { seatId, reminderId: r.reminderId };
		}
		return undefined;
	}

	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	let choosing = $state<string | undefined>();
	let chooserOpen = $state(false);
	function choose(label: string) {
		choosing = label;
		chooserOpen = true;
	}
	function put(seatId: SeatId) {
		chooserOpen = false;
		const label = choosing;
		choosing = undefined;
		const id = step?.character?.id;
		if (!label || !id) return;
		const at = placed(label);
		if (at) moveConfirm?.request(at.reminderId, seatId);
		else grimoire.run({ type: 'AddReminder', seatId, reminder: { characterId: id, label } });
	}

	let showOpen = $state(false);
	/** Shown: the step's character, or a suggested answer's (the Undertaker's). */
	let shownId = $state<CharacterId | undefined>();
	const shownCharacter = $derived(
		shownId ? characters.get(shownId) : (step?.character ?? undefined)
	);
	const done = $derived(step ? grimoire.isNightStepDone(night, step) : false);
</script>

<Dialog bind:open title={step ? stepName(step) : 'Night step'} size="full">
	{#if step}
		<div class="head">
			<span class="icon">
				<StepIcon {step} size={56} />
			</span>
			<p class="who">
				{holders.length > 0 ? holders.map((s) => seatName(game, s)).join(', ') : 'None'}
			</p>
		</div>
		<NightAlerts {grimoire} {step} />
		{#if step.id === TRAVELLER_ALIGNMENT_STEP}
			<TravellerAlignment
				{grimoire}
				travellers={step.travellers ?? []}
				onDraw={(seatId) => {
					open = false;
					onDraw(seatId);
				}}
			/>
		{/if}
		<NightSuggested
			{grimoire}
			{step}
			onShow={(id) => {
				open = false;
				shownId = id;
				showOpen = true;
			}}
		/>
		{#if step.reminder}
			<p class="text">
				{#if step.character}
					<NightText text={step.reminder} character={step.character} {night} />
				{:else}
					{step.reminder}
				{/if}
			</p>
		{/if}
		{#if labels.length > 0}
			<h3>Reminders</h3>
			<ul class="reminders">
				{#each labels as label (label)}
					{@const at = placed(label)}
					<li>
						<ReminderToken
							{label}
							type={step.character?.type}
							alignment={step.character
								? placingAlignment(game, step.character.id, characters)
								: undefined}
						/>
						<span class="where">{at ? `On ${seatName(game, at.seatId)}` : 'Not placed'}</span>
						<Button variant="quiet" onclick={() => choose(label)}>{at ? 'Move' : 'Place'}</Button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	{#snippet actions()}
		<Button
			variant="quiet"
			icon="info"
			onclick={() => {
				open = false;
				onInfoTokens();
			}}>Info tokens</Button
		>
		<Button
			variant="quiet"
			disabled={!step?.character}
			onclick={() => {
				open = false;
				shownId = undefined;
				showOpen = true;
			}}>Show to player</Button
		>
		<Button
			variant="accent"
			icon="check"
			onclick={() => {
				if (step && !done) grimoire.toggleNightStep(night, step);
				open = false;
			}}>Done</Button
		>
	{/snippet}
</Dialog>

<SeatChooser
	bind:open={chooserOpen}
	title={choosing ? `Put ${choosing} on` : 'Put on'}
	{game}
	{characters}
	onChoose={put}
/>

<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />

<!-- Closing the player view returns to this step (Trevor, 2026-10-16). -->
<ShowToPlayer
	bind:open={showOpen}
	characters={shownCharacter ? [{ character: shownCharacter }] : []}
	onclose={() => (open = true)}
/>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.icon {
		display: grid;
		place-items: center;
		width: calc(3.5 * var(--u));
		height: calc(3.5 * var(--u));
		--icon-size: calc(2.25 * var(--u));
		color: var(--heading);
	}
	.who {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.text {
		font-family: var(--font-ability);
		line-height: 1.4;
	}
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.reminders {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminders li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.where {
		flex: 1;
		min-width: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
