<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { trueCharacter } from '#lib/core/model/index.ts';
	import { abilityState, type NightStep } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A step whose character gives the Storyteller an ability (`givesAbility` to the
	 * Storyteller): once the Plague Doctor has died, the Storyteller picks the Minion ability
	 * they gain, which then sits on the board with the Fabled and Loric
	 * (https://wiki.bloodontheclocktower.com/Plague_Doctor; Trevor, 2026-10-30). If the Plague
	 * Doctor was drunk or poisoned when it died nothing is gained: a warning, never a lock.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const via = $derived(step.character?.id);
	const rule = $derived(via ? rulesOf(via, characters)?.givesAbility : undefined);
	const held = $derived(game.storytellerAbilities?.find((a) => a.via === via)?.characterId);
	// The giver's players: whether any died with a working ability.
	const givers = $derived(
		via ? game.seating.filter((s) => trueCharacter(game, s, characters) === via) : []
	);
	const dead = $derived(givers.filter((s) => game.seats[s].dead));
	const impaired = $derived(
		dead.length > 0 && dead.every((s) => abilityState(game, s, characters).impairments.length > 0)
	);
	let pickerOpen = $state(false);

	function pick(characterId: CharacterId | undefined) {
		pickerOpen = false;
		if (via) grimoire.run({ type: 'SetStorytellerAbility', via, characterId });
	}
</script>

{#if rule?.to === 'storyteller' && (dead.length > 0 || held)}
	<h3>Storyteller's ability</h3>
	<div class="row" data-testid="storyteller-ability">
		{#if held}
			<CharacterBadge characterId={held} character={characters.get(held)} />
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" onclick={() => (pickerOpen = true)}>
			{held ? 'Change' : 'Choose'}
		</Button>
	</div>
	{#if impaired && !held}
		<p class="warn" role="note">
			Drunk or poisoned when it died: the Storyteller gains no ability.
		</p>
	{/if}
	<CharacterPicker
		bind:open={pickerOpen}
		title="Storyteller's ability"
		{characters}
		script={game.script}
		types={rule.types}
		current={held}
		onPick={pick}
		onNone={held ? () => pick(undefined) : undefined}
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
		color: var(--on-surface-muted);
	}
	.warn {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
</style>
