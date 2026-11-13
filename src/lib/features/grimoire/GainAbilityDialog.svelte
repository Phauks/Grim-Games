<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { trueCharacter, type GivenAbility, type SeatId } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { SEAT_TYPES } from './board.ts';
	import CharacterPicker from '#lib/features/grimoire/seats/CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Gain ability (Trevor, 2026-11-03): the abilities a player has besides their character's,
	 * without changing their character or character type. A character's ability, which wakes them
	 * when that character would, or the Storyteller's own words, shown only (M34,
	 * `GiveAbility`). Abilities another character gave (the Boffin's, the Philosopher's) are
	 * listed too, and can be taken away here. A character that gains an ability of its own
	 * (the Alchemist's Minion, the Apprentice's, `swapsForAbility`) picks it here too, of the
	 * types its rule gives for the player's alignment, and keeps its own token (Trevor,
	 * 2026-11-12: one Gain ability, not a second item that swapped the token).
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** The player's name, or "Seat N". */
		title: string;
	}

	let { open = $bindable(), grimoire, seatId, title }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const held = $derived(seat?.abilities ?? []);
	const custom = $derived(seat?.customAbilities ?? []);
	const inPlay = $derived(
		new Set(game.seating.flatMap((s) => trueCharacter(game, s, characters) ?? []))
	);

	// Their own character's ability (the Alchemist's Minion): one, recorded as given by it.
	const own = $derived(seatId === undefined ? undefined : trueCharacter(game, seatId, characters));
	const ownRule = $derived(
		own === undefined ? undefined : rulesOf(own, characters)?.swapsForAbility
	);
	const ownTypes = $derived.by(() => {
		if (!ownRule) return [];
		if (seat?.alignment === 'good') return ownRule.good;
		if (seat?.alignment === 'evil') return ownRule.evil;
		return [...new Set([...ownRule.good, ...ownRule.evil])];
	});
	const ownGained = $derived(
		own === undefined ? undefined : held.find((a) => a.via === own)?.characterId
	);

	let pickerOpen = $state(false);
	let ownOpen = $state(false);
	let textOpen = $state(false);
	let text = $state('');

	function give(ability: GivenAbility) {
		if (seatId) grimoire.run({ type: 'GiveAbility', seatId, ability });
	}
	function remove(ability: GivenAbility) {
		if (seatId) grimoire.run({ type: 'RemoveAbility', seatId, ability });
	}
	function pick(characterId: CharacterId) {
		pickerOpen = false;
		give({ characterId });
	}
	function pickOwn(characterId: CharacterId) {
		ownOpen = false;
		if (!own || characterId === ownGained) return;
		if (ownGained) remove({ characterId: ownGained, via: own });
		give({ characterId, via: own });
	}
	function openText() {
		text = '';
		textOpen = true;
	}
	function saveText() {
		const words = text.trim();
		if (!words) return;
		textOpen = false;
		give({ text: words });
	}
	const nameOf = (id: CharacterId) => characters.get(id)?.name ?? id;
</script>

<Dialog bind:open title="Gain ability" description={title}>
	<ul class="list" data-testid="gained-abilities">
		{#each held as ability (`${ability.via ?? ''}:${ability.characterId}`)}
			<li>
				<CharacterPiece
					template="badge"
					characterId={ability.characterId}
					character={characters.get(ability.characterId)}
				/>
				<span class="from"
					>{#if ability.via}From the <CharacterPiece
							template="badge"
							characterId={ability.via}
							character={characters.get(ability.via)}
							interactive={false}
						/>{:else}Given by the Storyteller{/if}</span
				>
				<DeleteButton
					label={`Remove the ${nameOf(ability.characterId)} ability`}
					onclick={() => remove({ characterId: ability.characterId, via: ability.via })}
				/>
			</li>
		{/each}
		{#each custom as words (words)}
			<li>
				<span class="words">{words}</span>
				<DeleteButton label={`Remove ${words}`} onclick={() => remove({ text: words })} />
			</li>
		{/each}
		{#if held.length === 0 && custom.length === 0}
			<li class="none">None</li>
		{/if}
	</ul>
	<div class="add">
		{#if own && ownRule}
			<Button variant="quiet" icon="add" onclick={() => (ownOpen = true)}
				>{nameOf(own)} ability</Button
			>
		{/if}
		<Button variant="quiet" icon="add" onclick={() => (pickerOpen = true)}>Character ability</Button
		>
		<Button variant="quiet" icon="add" onclick={openText}>Custom</Button>
	</div>
</Dialog>

<CharacterPicker
	bind:open={pickerOpen}
	title={`Ability ${title} gains`}
	{characters}
	script={game.script}
	types={SEAT_TYPES}
	exclude={held.filter((a) => a.via === undefined).map((a) => a.characterId)}
	faded={(c) => (inPlay.has(c.id) ? 'In play' : undefined)}
	onPick={pick}
/>

<CharacterPicker
	bind:open={ownOpen}
	title={`Ability ${title} gains`}
	{characters}
	script={game.script}
	types={ownTypes}
	current={ownGained}
	faded={(c) => (inPlay.has(c.id) ? 'In play' : undefined)}
	onPick={pickOwn}
/>

<Dialog bind:open={textOpen} title="Custom ability" description={title}>
	<TextField label="Ability" bind:value={text} maxlength={200} oncommit={saveText} />
	{#snippet actions()}
		<ModalActions
			onCancel={() => (textOpen = false)}
			onConfirm={saveText}
			disabled={text.trim() === ''}
		/>
	{/snippet}
</Dialog>

<style>
	.list {
		display: grid;
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border); /* px-ok: a hairline divider */
	}
	.from,
	.none {
		flex: 1;
		color: var(--on-surface-muted);
	}
	.words {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
