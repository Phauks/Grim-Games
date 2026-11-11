<script lang="ts">
	import { alignmentOf, trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import {
		jinxChoiceMisfits,
		jinxChoiceTonight,
		nightChoosers
	} from '#lib/core/rules/jinxes/jinx-choices.ts';
	import { type NightStep } from '#lib/core/rules/night/night-order.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SeatBadge from './SeatBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { stepHolders } from '#lib/core/rules/night/board-steps.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A jinx's night choice (`nightChoice`, `rules/jinxes/jinx-choices.ts`): whom the Leviathan or
	 * Riot chose tonight, recorded in the day log as its ability used on that player
	 * (https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes). The dead, the evil (when
	 * the choice is of a good player) and anyone chosen on an earlier night are faded, still
	 * choosable: the Storyteller decides. What a chosen partner does is a night alert.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const choice = $derived(step.jinxChoice);
	const chooser = $derived(
		choice
			? nightChoosers(game, characters).find((c) => c.characterId === choice.characterId)
			: undefined
	);
	const tonight = $derived(choice ? jinxChoiceTonight(game, choice.characterId) : undefined);
	const misfits = $derived(chooser ? jinxChoiceMisfits(game, chooser) : undefined);
	// Whose ability it is: tonight's chooser as recorded, else the step's first living holder.
	const by = $derived.by((): SeatId | undefined => {
		if (tonight) return tonight.by;
		const holders = stepHolders(game, step, characters);
		return holders.find((s) => !game.seats[s].dead) ?? holders[0];
	});
	let open = $state(false);
	// eslint-disable-next-line grim/names-as-badges -- the dialog's spoken name; its heading shows the badge
	const title = $derived(`${step.character?.name ?? ''} chose`);

	function clear() {
		if (tonight) grimoire.run({ type: 'RemoveDayEntry', entryId: tonight.entryId });
	}
	function choose(seatId: SeatId) {
		open = false;
		if (!choice || by === undefined) return;
		clear();
		grimoire.run({ type: 'UseAbility', seatId: by, characterId: choice.characterId, on: seatId });
	}
	function none() {
		open = false;
		clear();
	}
</script>

{#if choice}
	<h3>Chosen tonight</h3>
	<div class="row" data-testid="jinx-choice">
		{#if tonight}
			{@const id = trueCharacter(game, tonight.seatId, characters)}
			{#if id}
				<CharacterPiece
					template="badge"
					characterId={id}
					character={characters.get(id)}
					alignment={alignmentOf(game, tonight.seatId)}
					playerName={seatName(game, tonight.seatId)}
				/>
			{:else}
				<SeatBadge {game} seatId={tonight.seatId} />
			{/if}
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" disabled={by === undefined} onclick={() => (open = true)}>
			{tonight ? 'Change' : 'Choose'}
		</Button>
	</div>
	<SeatChooser
		bind:open
		{title}
		{game}
		{characters}
		{misfits}
		onChoose={choose}
		onNone={tonight ? none : undefined}
	>
		{#snippet heading()}
			{#if step.character}<CharacterPiece
					template="badge"
					characterId={step.character.id}
					character={step.character}
					interactive={false}
				/>{/if} chose
		{/snippet}
	</SeatChooser>
{/if}

<style>
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.none {
		flex: 1;
		color: var(--on-surface-muted);
	}
</style>
