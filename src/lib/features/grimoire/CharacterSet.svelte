<script lang="ts">
	import type { AnswerValue } from '#lib/core/rules/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	/**
	 * A night answer's set of characters (the Godfather's Outsiders in play) as badges, then
	 * any more of the type the Storyteller picks ("+1 Outsider" for a Spy); "None" when empty.
	 */
	interface Props {
		value: Extract<AnswerValue, { kind: 'characters' }>;
		characters: CharacterLookup;
		interactive?: boolean;
	}

	let { value, characters, interactive = true }: Props = $props();
</script>

{#each value.value as id, n (id)}{n ? ', ' : ''}<CharacterBadge
		characterId={id}
		character={characters.get(id)}
		{interactive}
	/>{/each}{#if value.more}{value.value.length > 0 ? ', ' : ''}+<CountBadge
		count={value.more.count}
	/>
	{TYPE_LABELS[value.more.type]}{:else if value.value.length === 0}None{/if}
