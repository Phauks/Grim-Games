<script lang="ts">
	import type { CharacterLookup, DeathCause } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { causeCharacter, causeLabel } from './board.ts';

	interface Props {
		cause: DeathCause | undefined;
		characters: CharacterLookup;
		traveller?: boolean;
		/** False inside a button: the badge does not open the character. */
		interactive?: boolean;
	}

	let { cause, characters, traveller = false, interactive = true }: Props = $props();
	const characterId = $derived(causeCharacter(cause));
</script>

<!-- A death cause: its words, or the character whose ability killed, as a badge. -->
{#if characterId}<CharacterPiece
		template="badge"
		{characterId}
		character={characters.get(characterId)}
		{interactive}
	/>{:else}{causeLabel(cause, characters, traveller)}{/if}
