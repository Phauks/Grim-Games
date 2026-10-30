<!--
	About this reminder (Trevor, 2026-10-30), from a held bank token's ⋯ (ReminderBank): whose
	it is, what a setup suggestion is for, and the ability it comes from. Its actions are the
	⋯'s other rows; the token stays in hand underneath.
-->
<script lang="ts">
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import { prepTextSegments } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import type { BankItem } from './bank-items.ts';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { isGeneric } from './reminders.ts';

	interface Props {
		grimoire: Grimoire;
		open: boolean;
		item: BankItem | undefined;
	}

	let { grimoire, open = $bindable(), item }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const names = $derived(characterNames([...characters.values()]));
	const owner = $derived(item && !isGeneric(item) ? characters.get(item.characterId) : undefined);
</script>

<Dialog bind:open title="About this reminder">
	<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
	{#snippet heading()}
		{#if item}<BoardReminder
				label={item.label}
				character={characters.get(item.characterId)}
				alignment={placingAlignment(game, item, characters)}
				infinite={isGeneric(item)}
				symbol={item.token?.symbol}
				symbolColour={item.token?.symbolColour}
				symbolFill={item.token?.symbolFill}
			/>{:else}About this reminder{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if item && owner}From <CharacterBadge characterId={item.characterId} character={owner} />{/if}
	{/snippet}
	{#if item?.setup}
		{@const s = item.setup.suggestion}
		<p class="text" data-testid="setup-reason">
			{#each prepTextSegments(s.text, names) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
						label={part.label}
						character={owner}
					/>{:else if part.kind === 'character'}<CharacterBadge
						characterId={part.id}
						character={characters.get(part.id)}
					/>{:else}{part.text}{/if}{/each}
		</p>
	{/if}
	{#if owner}<CharacterSummary character={owner} reminders={false} />{/if}
</Dialog>

<style>
	.text {
		margin: 0 0 var(--space-3);
		line-height: 1.9;
	}
</style>
