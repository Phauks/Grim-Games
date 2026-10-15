<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { PrepSegment } from '#lib/core/rules/setup-reminders.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';

	interface Props {
		segments: readonly PrepSegment[];
		/** The character whose prep this is: its tokens take its icon and type colour. */
		character: Character;
	}

	let { segments, character }: Props = $props();
</script>

<!-- A pre-game prep step: its tokens and character names drawn as tokens and badges. -->
<span class="prep-text"
	>{#each segments as s, i (i)}{#if s.kind === 'text'}{s.text}{:else if s.kind === 'character'}<CharacterBadge
				characterId={s.id}
			/>{:else}<ReminderToken
				label={s.label}
				type={character.type}
				characterId={character.id}
			/>{/if}{/each}</span
>

<style>
	.prep-text :global(.badge) {
		margin-block: calc(var(--space-1) * -1);
	}
</style>
