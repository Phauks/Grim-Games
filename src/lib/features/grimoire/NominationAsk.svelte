<script lang="ts">
	import type { NominationPrompt } from '#lib/core/modes/index.ts';
	import type { CharacterNominationPrompt } from '#lib/core/rules/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import RuleHeader from '#lib/features/modes/RuleHeader.svelte';
	import { spawnedBy } from '#lib/features/modes/spawned-by.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { seatNominations } from '#lib/core/rules/index.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * What a recorded nomination sets off under the game's special rules (`nominationPrompts`
	 * in core), one question at a time:
	 * - The Warrens (https://beardytas.com/garden-of-djinn/the-warrens/): Confirm swaps the two
	 *   evil players' character tokens; each keeps their alignment.
	 * - The Djinn's Bargain (https://beardytas.com/garden-of-djinn/the-djinns-bargain/): asked
	 *   only of the Storyteller, once the player has said so; Confirm marks the nominator dead.
	 * - A character's own ability (`characterNominationPrompts`), such as the Virgin
	 *   (https://wiki.bloodontheclocktower.com/Virgin): Confirm executes the nominator, with the
	 *   character as the cause of death, and marks the ability used ("No Ability").
	 * - A player's ability set off by the nomination of the player carrying its reminder, such as
	 *   the Gnome's Amigo (https://wiki.bloodontheclocktower.com/Gnome): asked once the Gnome
	 *   says so; Confirm marks the nominator dead, with the character as the cause.
	 * - A character in play that has the nominee choose a player (the Big Wig,
	 *   https://wiki.bloodontheclocktower.com/Big_Wig): a seat chooser records whom, on the
	 *   nomination, so the day view can offer Broke madness for them.
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
	/** The rule asking, shown at the top (Trevor, 2026-10-23). */
	const spawning = $derived(
		ask && 'rule' in ask
			? spawnedBy(game.gameId, (p) => 'nominations' in p).filter((r) => r.name === ask.rule)
			: []
	);

	const label = (seatId: SeatId) => seatLabel(game, seatId);

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way: this question is answered, and the next one, if any, opens.
	$effect(() => {
		if (!open && ask) asks = asks.slice(1);
	});

	/** Records whom the nominee chose on their nomination (`ChooseForNomination`). */
	function choose(chosen: SeatId | undefined) {
		const nomination = ask && seatNominations(game, ask.nominee).received;
		open = false;
		if (!nomination || nomination.nominator !== ask?.nominator) return;
		grimoire.run({
			type: 'ChooseForNomination',
			entryId: nomination.entryId,
			...(chosen ? { chosen } : {})
		});
	}

	function confirm() {
		if (!ask || ask.kind === 'nominee-chooses') return;
		const { nominator, nominee } = ask;
		if (ask.kind === 'execute-nominator') {
			grimoire.run({ type: 'Execute', seatId: nominator, cause: ask.characterId });
			grimoire.run({
				type: 'UseAbility',
				seatId: nominee,
				characterId: ask.characterId,
				on: nominator
			});
		} else if (ask.kind === 'may-kill-nominator') {
			grimoire.run({ type: 'SetDead', seatId: nominator, dead: true, cause: ask.characterId });
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
	// The dialog's accessible name; its heading shows the players as badges.
	/* eslint-disable grim/names-as-badges -- an accessible name, see above */
	const title = $derived(
		ask?.kind === 'nominee-chooses'
			? `${source}: who did ${label(ask.nominee)} choose?`
			: ask?.kind === 'execute-nominator'
				? `${source}: execute ${label(ask.nominator)}?`
				: ask?.kind === 'may-kill-nominator'
					? `${source}: kill ${label(ask.nominator)}?`
					: ask?.kind === 'evil-swap'
						? `${source}: swap characters?`
						: ask
							? `${source}: did ${label(ask.nominator)} choose to die?`
							: ''
	);
	/* eslint-enable grim/names-as-badges */
</script>

{#if ask?.kind === 'nominee-chooses'}
	<SeatChooser
		bind:open
		{title}
		{game}
		{characters}
		onNone={() => choose(undefined)}
		onChoose={(seatId) => choose(seatId)}
	>
		{#snippet heading()}{source}: who did {@render player(ask.nominee)} choose?{/snippet}
	</SeatChooser>
{:else}
	<ConfirmDialog bind:open {title} onConfirm={confirm}>
		{#snippet heading()}{#if ask?.kind === 'execute-nominator'}{source}: execute {@render player(
					ask.nominator
				)}?{:else if ask?.kind === 'may-kill-nominator'}{source}: kill {@render player(
					ask.nominator
				)}?{:else if ask?.kind === 'evil-swap'}{source}: swap characters?{:else if ask}{source}: did {@render player(
					ask.nominator
				)} choose to die?{/if}{/snippet}
		{#if ask}
			<RuleHeader rules={spawning} />
			<dl class="change">
				{#each [['Nominator', ask.nominator], ['Nominee', ask.nominee]] as const as [what, seatId] (what)}
					{@const id = game.seats[seatId]?.characterId}
					{@const character = id ? characters.get(id) : undefined}
					<dt>{what}</dt>
					<dd>
						{@render player(seatId)}
						{#if id && character}<CharacterBadge characterId={id} {character} />{/if}
					</dd>
				{/each}
				<dt>Then</dt>
				<dd>
					{#if ask.kind === 'execute-nominator'}
						{@render player(ask.nominator)} is executed, and the {source}’s ability is used.
					{:else if ask.kind === 'may-kill-nominator'}
						{@render player(ask.nominator)} dies. Continue voting.
					{:else if ask.kind === 'evil-swap'}
						They swap character tokens and learn their new characters tonight.
					{:else}
						{@render player(ask.nominator)} dies. {@render player(ask.nominee)}’s ability works
						twice until dusk tomorrow.
					{/if}
				</dd>
			</dl>
		{/if}
	</ConfirmDialog>
{/if}

{#snippet player(seatId: SeatId)}<PlayerBadge name={seatName(game, seatId)} />{/snippet}

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
