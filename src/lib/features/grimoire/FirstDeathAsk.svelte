<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A player marked dead whose ability stops their first death, unused and working (Trevor,
	 * 2026-10-22): the first time the Fool dies, they don't
	 * (https://wiki.bloodontheclocktower.com/Fool), except to the Assassin. Confirm keeps them
	 * alive and places the ability's spent token (the Fool's "No Ability"); Cancel leaves the
	 * death as marked. Rules: `survivesFirstDeath` in core.
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

	function keepAlive() {
		if (!ask) return;
		const { seatId, characterId, spentToken } = ask;
		if (grimoire.run({ type: 'SetDead', seatId, dead: false }))
			grimoire.run({
				type: 'AddReminder',
				seatId,
				reminder: { characterId, label: spentToken }
			});
		grimoire.firstDeathAsk = undefined;
	}
</script>

<ConfirmDialog
	bind:open
	{title}
	onConfirm={keepAlive}
	onCancel={() => (grimoire.firstDeathAsk = undefined)}
>
	{#if ask && character}
		<p class="ability">
			<CharacterBadge characterId={ask.characterId} {character} />
			<GlossaryText text={character.ability} names={[character.name]} />
		</p>
		<dl class="change">
			<dt>Player</dt>
			<dd><PlayerBadge name={seatName(grimoire.game, ask.seatId)} /></dd>
			<dt>Places</dt>
			<dd><ReminderToken label={ask.spentToken} {character} /></dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-2);
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
