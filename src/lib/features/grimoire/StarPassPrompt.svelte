<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { starPass } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The Imp killed itself with a Minion alive (Trevor, 2026-10-19): ask which Minion becomes
	 * the Imp (https://wiki.bloodontheclocktower.com/Imp), the Scarlet Woman chosen first when
	 * her ability makes it hers. A suggestion: Cancel leaves everyone as they are, and asks
	 * again only if the living Minions change. Rules: `starPass` in core.
	 */
	interface Props {
		grimoire: Grimoire;
		/** False once the game has ended. */
		active: boolean;
	}

	let { grimoire, active }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const pass = $derived(active ? starPass(game, characters) : undefined);
	const imp = $derived(characters.get('imp'));

	let open = $state(false);
	let choice = $state<SeatId>('');
	let asked = $state<string>();
	$effect(() => {
		if (!pass || open) return;
		const key = pass.minions.join(',');
		if (asked === key) return;
		asked = key;
		choice = pass.preferred ?? pass.minions[0];
		open = true;
	});

	const playerName = (id: SeatId) =>
		game.seats[id]?.playerName ?? `Seat ${game.seating.indexOf(id) + 1}`;

	function confirm() {
		if (choice && pass?.minions.includes(choice))
			grimoire.run({ type: 'AssignCharacter', seatId: choice, characterId: 'imp' });
	}
</script>

<ConfirmDialog bind:open title="Choose the new Imp" onConfirm={confirm}>
	{#if imp}<p class="ability">
			<CharacterBadge characterId="imp" character={imp} inline />
			<GlossaryText text={imp.ability} names={[imp.name]} />
		</p>{/if}
	{#if pass}
		<ChoiceGroup
			label="New Imp"
			value={choice}
			options={pass.minions.map((id) => ({ value: id, label: playerName(id) }))}
			onChange={(id) => (choice = id)}
		>
			{#snippet item(option)}
				{@const s = game.seats[option.value]}
				{#if s?.characterId}<CharacterBadge
						characterId={s.characterId}
						character={characters.get(s.characterId)}
						alignment={s.alignment}
						playerName={option.label}
						inline
					/>{:else}{option.label}{/if}
			{/snippet}
		</ChoiceGroup>
	{/if}
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-3);
	}
</style>
