<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { madAsChoice } from '#lib/core/rules/abilities/mad-as.ts';
	import { type NightStep } from '#lib/core/rules/night/night-order.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from '#lib/features/grimoire/seats/CharacterPicker.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

	/**
	 * The character the step's chosen player is mad as (`madAs` with `mad: "carrier"`: the
	 * Cerenovus's good character, https://wiki.bloodontheclocktower.com/Cerenovus), recorded on
	 * its placed token so the board marks the mad player ! (Trevor, 2026-11-03, M36). Before the
	 * token is placed the row stays, with Choose disabled, so nothing moves (no reflow).
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const by = $derived(step.gained ? undefined : step.character?.id);
	const choice = $derived(by ? madAsChoice(game, by, characters) : undefined);
	const token = $derived(choice?.token);
	/** The jinxed partners' types, so they can be picked too (the Goblin, by its jinx). */
	const types = $derived.by(() => {
		if (!choice) return [];
		const extra = choice.partners.flatMap((id) => characters.get(id)?.type ?? []);
		return [...new Set([...choice.types, ...extra])];
	});
	const exclude = $derived.by(() => {
		if (!choice) return [];
		return [...characters.values()]
			.filter((c) => !choice.types.includes(c.type) && !choice.partners.includes(c.id))
			.map((c) => c.id);
	});
	let pickerOpen = $state(false);

	function pick(characterId: CharacterId | undefined) {
		pickerOpen = false;
		if (!token || characterId === token.madAs) return;
		grimoire.run({
			type: 'SetReminderMadAs',
			reminderId: token.reminderId,
			...(characterId ? { characterId } : {})
		});
	}
</script>

{#if choice}
	<h3>Mad as</h3>
	<div class="row" data-testid="mad-as">
		{#if token?.madAs}
			<CharacterPiece
				template="badge"
				characterId={token.madAs}
				character={characters.get(token.madAs)}
			/>
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" disabled={!token} onclick={() => (pickerOpen = true)}>
			{token?.madAs ? 'Change' : 'Choose'}
		</Button>
	</div>
	<CharacterPicker
		bind:open={pickerOpen}
		title="Mad as"
		{characters}
		script={game.script}
		{types}
		{exclude}
		current={token?.madAs}
		onPick={pick}
		onNone={token?.madAs ? () => pick(undefined) : undefined}
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
</style>
