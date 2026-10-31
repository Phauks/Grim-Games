<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
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
	 * her ability makes it hers. The same for any Demon whose death by its own kill passes it on,
	 * as the Fang Gu's does to an Outsider, who turns evil
	 * (https://wiki.bloodontheclocktower.com/Fang_Gu). A suggestion: Cancel leaves everyone as
	 * they are, and asks again only if the players who may take it on change. Rules: `starPass`
	 * in core.
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
	const demon = $derived(pass && characters.get(pass.characterId));
	// eslint-disable-next-line grim/names-as-badges -- a dialog title is plain text ("Choose the new Imp", Trevor 2026-10-19); the badge is in the body
	const title = $derived(`Choose the new ${demon?.name ?? 'Demon'}`);
	// eslint-disable-next-line grim/names-as-badges -- a field label is plain text ("New Imp"); the badge is in the body
	const choiceLabel = $derived(`New ${demon?.name ?? 'Demon'}`);

	let open = $state(false);
	let choice = $state<SeatId>('');
	let asked = $state<string>();
	$effect(() => {
		if (!pass || open) return;
		const key = `${pass.characterId}:${pass.heirs.join(',')}`;
		if (asked === key) return;
		asked = key;
		choice = pass.preferred ?? pass.heirs[0];
		open = true;
	});

	const playerName = (id: SeatId) => seatName(game, id);

	function confirm() {
		if (choice && pass?.heirs.includes(choice))
			grimoire.run({
				type: 'AssignCharacter',
				seatId: choice,
				characterId: pass.characterId,
				alignment: 'evil'
			});
	}
</script>

<ConfirmDialog bind:open {title} onConfirm={confirm}>
	{#if demon}<p class="ability">
			<CharacterBadge characterId={demon.id} character={demon} />
			<GlossaryText text={demon.ability} names={[demon.name]} />
		</p>{/if}
	{#if pass}
		<ChoiceGroup
			label={choiceLabel}
			value={choice}
			options={pass.heirs.map((id) => ({ value: id, label: playerName(id) }))}
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
	{/if}
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-3);
	}
</style>
