<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Which living player becomes the Demon `characterId` (shared by the Demon's own star pass,
	 * `StarPassPrompt`, and the Hindu's optional rule, `ReincarnateAsk`): the Demon's ability,
	 * then the players who may take it on. Confirm makes the chosen player that Demon, evil;
	 * Cancel leaves everyone as they are.
	 */
	interface Props {
		grimoire: Grimoire;
		open: boolean;
		characterId: CharacterId;
		heirs: SeatId[];
		/** Chosen first: the player a rule says takes it on (the Scarlet Woman). */
		preferred?: SeatId;
	}

	let { grimoire, open = $bindable(), characterId, heirs, preferred }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const demon = $derived(characters.get(characterId));
	// eslint-disable-next-line grim/names-as-badges -- a dialog title is plain text ("Choose the new Imp", Trevor 2026-10-19); the badge is in the body
	const title = $derived(`Choose the new ${demon?.name ?? 'Demon'}`);
	// eslint-disable-next-line grim/names-as-badges -- a field label is plain text ("New Imp"); the badge is in the body
	const choiceLabel = $derived(`New ${demon?.name ?? 'Demon'}`);

	let choice = $state<SeatId>('');
	$effect(() => {
		if (open) choice = preferred ?? heirs[0] ?? '';
	});

	function confirm() {
		if (choice && heirs.includes(choice))
			grimoire.run({ type: 'AssignCharacter', seatId: choice, characterId, alignment: 'evil' });
	}
</script>

<ConfirmDialog bind:open {title} onConfirm={confirm}>
	{#if demon}<p class="ability">
			<CharacterBadge characterId={demon.id} character={demon} />
			<GlossaryText text={demon.ability} names={[demon.name]} />
		</p>{/if}
	<ChoiceGroup
		label={choiceLabel}
		value={choice}
		options={heirs.map((id) => ({ value: id, label: seatName(game, id) }))}
		onChange={(id) => (choice = id)}
	>
		{#snippet item(option)}
			{@const s = game.seats[option.value]}
			{#if s?.characterId}<CharacterBadge
					characterId={s.characterId}
					character={characters.get(s.characterId)}
					alignment={s.alignment}
					playerName={option.label}
				/>{:else}{option.label}{/if}
		{/snippet}
	</ChoiceGroup>
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-3);
	}
</style>
