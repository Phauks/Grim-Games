<script lang="ts">
	import { alignmentOf } from '#lib/core/model/index.ts';
	import AbilityText from '#lib/features/characters/AbilityText.svelte';
	import SeatBadge from './SeatBadge.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A player marked dead whose ability stops their first death, unused and working (Trevor,
	 * 2026-10-22): the first time the Fool dies, they don't
	 * (https://wiki.bloodontheclocktower.com/Fool), except to the Assassin. Confirm keeps them
	 * alive and places the ability's spent token (the Fool's "No Ability"); Cancel leaves the
	 * death as marked. Rules: `survivesFirstDeath` in core.
	 *
	 * A death that sets off the ability by placing its reminder (`places`, Trevor 2026-11-06):
	 * the Barber's "Haircuts Tonight" (https://wiki.bloodontheclocktower.com/Barber). Confirm
	 * places it on the dead player; Cancel leaves it off. Rules: `deathReminder` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.firstDeathAsk);
	const character = $derived(ask && grimoire.open.characters.get(ask.characterId));
	// eslint-disable-next-line grim/names-as-badges -- a dialog title is plain text (Trevor's wording, "Use the Fool’s ability?"); the badge is in the body
	const title = $derived(`Use the ${character?.name ?? ''}’s ability?`);

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Cancel, Escape, the close button): the question is answered.
	$effect(() => {
		if (!open) grimoire.firstDeathAsk = undefined;
	});

	function useAbility() {
		if (!ask) return;
		const { seatId, characterId, token, places } = ask;
		if (places || grimoire.run({ type: 'SetDead', seatId, dead: false }))
			grimoire.run({
				type: 'AddReminder',
				seatId,
				reminder: { characterId, label: token }
			});
		grimoire.firstDeathAsk = undefined;
	}
</script>

<ConfirmDialog
	bind:open
	{title}
	onConfirm={useAbility}
	onCancel={() => (grimoire.firstDeathAsk = undefined)}
>
	{#if ask && character}
		<div class="ability">
			<CharacterPiece template="row" {character} info>
				{#snippet abilityText()}<AbilityText
						text={character.ability}
						names={[character.name]}
					/>{/snippet}
			</CharacterPiece>
		</div>
		<dl class="change">
			<dt>Player</dt>
			<dd><SeatBadge game={grimoire.game} seatId={ask.seatId} /></dd>
			<dt>Places</dt>
			<dd>
				<BoardReminder
					label={ask.token}
					{character}
					alignment={alignmentOf(grimoire.game, ask.seatId)}
				/>
			</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-3);
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
</style>
