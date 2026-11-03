<script lang="ts">
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { HistoryPart } from './history.ts';
	import { tokenLabel } from './reminders.ts';

	/** One History entry as words and badges: History, and an ended game's board. */
	interface Props {
		parts: readonly HistoryPart[];
		characters: CharacterLookup;
	}

	let { parts, characters }: Props = $props();
</script>

{#each parts as part, i (i)}{#if part.kind === 'text'}{part.text}{:else if part.kind === 'seat'}{#if part.characterId}<CharacterPiece
				template="badge"
				characterId={part.characterId}
				character={characters.get(part.characterId)}
				alignment={part.alignment}
				playerName={part.name}
			/>{:else}<PlayerBadge
				name={part.name}
			/>{/if}{:else if part.kind === 'character'}<CharacterPiece
			template="badge"
			characterId={part.characterId}
			character={characters.get(part.characterId)}
		/>{:else}<span class="chip"
			><ReminderToken label={tokenLabel(part)} character={characters.get(part.characterId)} /></span
		>{/if}{/each}

<style>
	.chip {
		display: inline-block;
		vertical-align: middle;
	}
</style>
