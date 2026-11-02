<script lang="ts">
	import type { CharacterId, SeatedType } from '#lib/core/data/index.ts';
	import type { GivenInstead } from '#lib/core/data/jinx-rules.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import {
		alignmentOf,
		scriptCharacterIds,
		trueCharacter,
		typeOf,
		type SeatId
	} from '#lib/core/model/index.ts';
	import {
		abilityState,
		demonGoodNeighbours,
		givenInstead,
		replacingReminder,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A step whose character gives the Storyteller an ability (`givesAbility` to the
	 * Storyteller): once the Plague Doctor has died, the Storyteller picks the Minion ability
	 * they gain, which then sits on the board with the Fabled and Loric
	 * (https://wiki.bloodontheclocktower.com/Plague_Doctor; Trevor, 2026-10-30). If the Plague
	 * Doctor was drunk or poisoned when it died nothing is gained: a warning, never a lock.
	 *
	 * A jinx may send the picked ability elsewhere (`givenInstead`, the Plague Doctor's Related
	 * Jinxes): a Minion holds it and is shown it (`a-minion`, as a held ability via the Plague
	 * Doctor), a player becomes it (`a-player-becomes`, then asked whether they turn evil), one
	 * of the Demon's good neighbours becomes it under the token they were shown
	 * (`demon-neighbour-becomes`, its Is The reminder, which asks the same), or up to two
	 * players become Outsiders (`outsiders`). The step then offers that instead.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show a character to its player (a Minion learns the ability it gains). */
		onShow?: (characterId: CharacterId) => void;
	}

	let { grimoire, step, onShow }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const via = $derived(step.character?.id);
	const rule = $derived(via ? rulesOf(via, characters)?.givesAbility : undefined);
	const held = $derived(game.storytellerAbilities?.find((a) => a.via === via)?.characterId);
	const script = $derived(scriptCharacterIds(game.script));
	// The giver's players: whether any died with a working ability.
	const givers = $derived(
		via ? game.seating.filter((s) => trueCharacter(game, s, characters) === via) : []
	);
	const dead = $derived(givers.filter((s) => game.seats[s].dead));
	const impaired = $derived(
		dead.length > 0 && dead.every((s) => abilityState(game, s, characters).impairments.length > 0)
	);
	let pickerOpen = $state(false);

	// ── A jinx's follow-up ──
	// The ability picked whose jinx sends it elsewhere, and what happens instead.
	let picked = $state<{ characterId: CharacterId; kind: GivenInstead }>();
	// The changes made for it on this step (a player who became the character, or an Outsider).
	let made = $state<{ seatId: SeatId; characterId: CharacterId }[]>([]);
	$effect.pre(() => {
		void step.id;
		picked = undefined;
		made = [];
	});
	let seatOpen = $state(false);
	let outsiderOpen = $state(false);
	let chosen = $state<SeatId>();

	// The Minions who hold an ability this giver sent them (`a-minion`).
	const minionHolders = $derived(
		via
			? game.seating.flatMap((seatId) =>
					(game.seats[seatId].abilities ?? [])
						.filter((a) => a.via === via)
						.map((a) => ({ seatId, characterId: a.characterId }))
				)
			: []
	);
	// What was picked on this step, else the ability a Minion already holds from this giver.
	const instead = $derived.by((): { characterId: CharacterId; kind: GivenInstead } | undefined => {
		if (picked) return picked;
		const first = minionHolders[0];
		return first ? { characterId: first.characterId, kind: 'a-minion' } : undefined;
	});
	// Takes back what a Minion was given, when the Storyteller picks again.
	function takeBack() {
		if (!via) return;
		for (const { seatId } of minionHolders) grimoire.run({ type: 'SetHeldAbility', seatId, via });
	}
	const shown = $derived(instead?.kind === 'a-minion' ? minionHolders : made);
	const neighbours = $derived(new Set(demonGoodNeighbours(game, characters)));
	const offered = $derived.by((): ((seatId: SeatId) => boolean) => {
		if (instead?.kind === 'a-minion')
			return (id) => typeOf(game, id, characters) === 'minion' && !game.seats[id].dead;
		if (instead?.kind === 'demon-neighbour-becomes') return (id) => neighbours.has(id);
		return (id) => game.seats[id].characterId !== undefined;
	});
	const more = $derived(
		instead?.kind === 'outsiders' ? made.length < 2 : shown.length === 0 && instead !== undefined
	);
	const OUTSIDERS: readonly SeatedType[] = ['outsider'];
	const inPlay = $derived(game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? []));

	function pick(characterId: CharacterId | undefined) {
		pickerOpen = false;
		if (!via) return;
		const kind = characterId ? givenInstead(via, characterId, script, characters) : undefined;
		if (characterId !== undefined && characterId === instead?.characterId) {
			seatOpen = more;
			return;
		}
		takeBack();
		if (characterId && kind) {
			picked = { characterId, kind };
			made = [];
			if (held) grimoire.run({ type: 'SetStorytellerAbility', via });
			seatOpen = true;
			return;
		}
		picked = undefined;
		made = [];
		if (held !== characterId) grimoire.run({ type: 'SetStorytellerAbility', via, characterId });
	}

	function chooseSeat(seatId: SeatId) {
		seatOpen = false;
		const now = instead;
		if (!via || !now) return;
		const { characterId, kind } = now;
		if (kind === 'a-minion') {
			grimoire.run({ type: 'SetHeldAbility', seatId, via, characterId });
			return;
		}
		if (kind === 'outsiders') {
			chosen = seatId;
			outsiderOpen = true;
			return;
		}
		const reminder =
			kind === 'demon-neighbour-becomes' ? replacingReminder(characterId, characters) : undefined;
		// Placing the reminder asks whether they turn evil, as at setup.
		const ok = reminder
			? grimoire.run({ type: 'AddReminder', seatId, reminder })
			: grimoire.run({ type: 'AssignCharacter', seatId, characterId, by: via });
		if (!ok) return;
		made = [{ seatId, characterId }];
		if (!reminder && alignmentOf(grimoire.game, seatId) !== 'evil')
			grimoire.alignmentAsk = { seatId, characterId, alignment: 'evil' };
	}

	function chooseOutsider(characterId: CharacterId) {
		outsiderOpen = false;
		const seatId = chosen;
		chosen = undefined;
		if (!seatId || !via) return;
		if (grimoire.run({ type: 'AssignCharacter', seatId, characterId, by: via }))
			made = [...made.filter((m) => m.seatId !== seatId), { seatId, characterId }];
	}

	// The chooser's plain title; its heading shows the character as a badge.
	const insteadTitle = $derived.by(() => {
		switch (instead?.kind) {
			case 'a-minion':
				return 'Gains the ability';
			case 'outsiders':
				return 'Becomes an Outsider';
			default:
				return 'Becomes the character';
		}
	});
</script>

{#snippet badge(characterId: CharacterId)}<CharacterBadge
		{characterId}
		character={characters.get(characterId)}
		interactive={false}
	/>{/snippet}

{#if rule?.to === 'storyteller' && (dead.length > 0 || held || instead)}
	<h3>Storyteller's ability</h3>
	<div class="row" data-testid="storyteller-ability">
		{#if held}
			<CharacterBadge characterId={held} character={characters.get(held)} />
		{:else if instead}
			<CharacterBadge
				characterId={instead.characterId}
				character={characters.get(instead.characterId)}
			/>
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" onclick={() => (pickerOpen = true)}>
			{held || instead ? 'Change' : 'Choose'}
		</Button>
	</div>
	{#if impaired && !held && !instead}
		<p class="warn" role="note">
			Drunk or poisoned when it died: the Storyteller gains no ability.
		</p>
	{/if}
	{#if instead}
		<p class="warn" role="note" data-testid="given-instead-note">
			{#if instead.kind === 'a-minion'}A Minion gains the {@render badge(instead.characterId)} ability
				instead, and learns this.{:else if instead.kind === 'a-player-becomes'}A player becomes the
				{@render badge(instead.characterId)} instead.{:else if instead.kind === 'demon-neighbour-becomes'}One
				of the Demon's good neighbours becomes the {@render badge(instead.characterId)} instead.{:else}Up
				to two players become Outsiders instead.{/if}
		</p>
		<div class="row" data-testid="given-instead">
			{#each shown as change (change.seatId)}
				<CharacterBadge
					characterId={change.characterId}
					character={characters.get(change.characterId)}
					alignment={alignmentOf(game, change.seatId)}
					playerName={seatName(game, change.seatId)}
				/>
				{#if onShow && instead.kind !== 'demon-neighbour-becomes'}
					<Button variant="quiet" onclick={() => onShow?.(change.characterId)}
						>Show to player</Button
					>
				{/if}
			{:else}
				<span class="none">None</span>
			{/each}
			{#if more}
				<Button variant="quiet" onclick={() => (seatOpen = true)}>Choose</Button>
			{/if}
		</div>
		<SeatChooser
			bind:open={seatOpen}
			title={insteadTitle}
			{game}
			{characters}
			offer={offered}
			onChoose={chooseSeat}
		>
			{#snippet heading()}
				{#if instead?.kind === 'a-minion'}Gains the {@render badge(instead.characterId)} ability{:else if instead?.kind === 'outsiders'}Becomes
					an Outsider{:else if instead}Becomes the {@render badge(instead.characterId)}{/if}
			{/snippet}
		</SeatChooser>
		<CharacterPicker
			bind:open={outsiderOpen}
			title="Choose an Outsider"
			{characters}
			script={game.script}
			types={OUTSIDERS}
			exclude={inPlay}
			onPick={chooseOutsider}
		/>
	{/if}
	<CharacterPicker
		bind:open={pickerOpen}
		title="Storyteller's ability"
		{characters}
		script={game.script}
		types={rule.types}
		current={held ?? instead?.characterId}
		onPick={pick}
		onNone={held || instead ? () => pick(undefined) : undefined}
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
