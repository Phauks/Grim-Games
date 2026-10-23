<script lang="ts">
	import type { NominationPrompt } from '#lib/core/modes/index.ts';
	import type { CharacterNominationPrompt } from '#lib/core/rules/index.ts';
	import { seatNumber, type SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * What a recorded nomination sets off under the game's special rules (`nominationPrompts`
	 * in core), one question at a time:
	 * - The Warrens (https://beardytas.com/garden-of-djinn/the-warrens/): Confirm swaps the two
	 *   evil players' character tokens; each keeps their alignment.
	 * - The Djinn's Bargain (https://beardytas.com/garden-of-djinn/the-djinns-bargain/): asked
	 *   only of the Storyteller, once the player has said so; Confirm marks the nominator dead.
	 * - A character's own ability (`characterNominationPrompts`), such as the Virgin
	 *   (https://wiki.bloodontheclocktower.com/Virgin): Confirm executes the nominator and marks
	 *   the ability used ("No Ability").
	 * Cancel, or closing, changes nothing (warn, never lock).
	 */
	interface Props {
		grimoire: Grimoire;
		/** The questions still to ask, first one showing. */
		asks: (NominationPrompt | CharacterNominationPrompt)[];
	}

	let { grimoire, asks = $bindable() }: Props = $props();

	const ask = $derived(asks[0]);
	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	function label(seatId: SeatId): string {
		const n = seatNumber(game, seatId);
		const name = game.seats[seatId]?.playerName;
		return name ? `Seat ${n} (${name})` : `Seat ${n}`;
	}

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way: this question is answered, and the next one, if any, opens.
	$effect(() => {
		if (!open && ask) asks = asks.slice(1);
	});

	function confirm() {
		if (!ask) return;
		const { nominator, nominee } = ask;
		if (ask.kind === 'execute-nominator') {
			grimoire.run({ type: 'Execute', seatId: nominator });
			grimoire.run({ type: 'UseAbility', seatId: nominee, characterId: ask.characterId });
		} else if (ask.kind === 'evil-swap') {
			const a = game.seats[nominator];
			const b = game.seats[nominee];
			if (a?.characterId && b?.characterId) {
				const [ac, bc] = [a.characterId, b.characterId];
				grimoire.run({
					type: 'AssignCharacter',
					seatId: nominator,
					characterId: bc,
					alignment: a.alignment
				});
				grimoire.run({
					type: 'AssignCharacter',
					seatId: nominee,
					characterId: ac,
					alignment: b.alignment
				});
			}
		} else grimoire.run({ type: 'SetDead', seatId: nominator, dead: true, cause: 'other' });
	}

	/** The special rule's name, or the character whose ability it is. */
	const source = $derived(
		!ask ? '' : 'rule' in ask ? ask.rule : (characters.get(ask.characterId)?.name ?? '')
	);
	const title = $derived(
		ask?.kind === 'execute-nominator'
			? `${source}: execute ${label(ask.nominator)}?`
			: ask?.kind === 'evil-swap'
				? `${source}: swap characters?`
				: ask
					? `${source}: did ${label(ask.nominator)} choose to die?`
					: ''
	);
</script>

<ConfirmDialog bind:open {title} onConfirm={confirm}>
	{#if ask}
		<dl class="change">
			{#each [['Nominator', ask.nominator], ['Nominee', ask.nominee]] as const as [what, seatId] (what)}
				{@const id = game.seats[seatId]?.characterId}
				{@const character = id ? characters.get(id) : undefined}
				<dt>{what}</dt>
				<dd>
					<strong>{label(seatId)}</strong>
					{#if id && character}<CharacterBadge characterId={id} {character} />{/if}
				</dd>
			{/each}
			<dt>Then</dt>
			<dd>
				{#if ask.kind === 'execute-nominator'}
					{label(ask.nominator)} is executed, and the {source}’s ability is used.
				{:else if ask.kind === 'evil-swap'}
					They swap character tokens and learn their new characters tonight.
				{:else}
					{label(ask.nominator)} dies. {label(ask.nominee)}’s ability works twice until dusk
					tomorrow.
				{/if}
			</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
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
