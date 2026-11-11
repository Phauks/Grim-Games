<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		abilityChoice,
		chosenAbility,
		choosesAbility
	} from '#lib/core/rules/abilities/chosen-ability.ts';
	import { type NightStep } from '#lib/core/rules/night/night-order.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { stepHolders } from '#lib/core/rules/night/board-steps.ts';
	import SeatBadge from './SeatBadge.svelte';

	/**
	 * The ability the step's player chooses to gain (`gainedFrom.choose`: the Philosopher's good
	 * character, https://wiki.bloodontheclocktower.com/Philosopher). Choosing one in play puts the
	 * token (Drunk) on its player; any other is held by the chooser, who keeps their token
	 * (Trevor, 2026-11-03, option A). Choosing again replaces the earlier choice.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const via = $derived(step.gained ? undefined : step.character?.id);
	const rule = $derived(via ? choosesAbility(game, via, characters) : undefined);
	const holder = $derived(rule ? stepHolders(game, step, characters)[0] : undefined);
	const chosen = $derived(
		via && holder !== undefined ? chosenAbility(game, holder, via, characters) : undefined
	);
	let pickerOpen = $state(false);

	function pick(characterId: CharacterId | undefined) {
		pickerOpen = false;
		if (!via || holder === undefined || !rule) return;
		if (characterId === chosen?.characterId) return;
		const plan = abilityChoice(game, holder, via, characterId, characters);
		if (!plan) return;
		if (plan.dropHeld)
			grimoire.run({
				type: 'RemoveAbility',
				seatId: holder,
				ability: { characterId: plan.dropHeld, via }
			});
		for (const reminderId of plan.dropReminders)
			grimoire.run({ type: 'RemoveReminder', reminderId });
		if (plan.tokenOn !== undefined)
			grimoire.run({
				type: 'AddReminder',
				seatId: plan.tokenOn,
				reminder: { characterId: via, label: rule.token }
			});
		if (plan.hold)
			grimoire.run({
				type: 'GiveAbility',
				seatId: holder,
				ability: { characterId: plan.hold, via }
			});
	}
</script>

{#if rule && holder !== undefined}
	<h3>Gained ability</h3>
	<div class="row" data-testid="gained-ability">
		{#if chosen}
			<CharacterPiece
				template="badge"
				characterId={chosen.characterId}
				character={characters.get(chosen.characterId)}
			/>
			{#if chosen.fromSeat !== undefined}
				<span class="where">Drunk: <SeatBadge {game} {characters} seatId={chosen.fromSeat} /></span>
			{/if}
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" onclick={() => (pickerOpen = true)}>
			{chosen ? 'Change' : 'Choose'}
		</Button>
	</div>
	<CharacterPicker
		bind:open={pickerOpen}
		title="Gained ability"
		{characters}
		script={game.script}
		types={rule.choose}
		current={chosen?.characterId}
		exclude={via ? [via] : []}
		onPick={pick}
		onNone={chosen ? () => pick(undefined) : undefined}
	/>
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
	}
	.none,
	.where {
		color: var(--on-surface-muted);
	}
</style>
