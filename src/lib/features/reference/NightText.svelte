<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { nightTextSegments } from '#lib/core/rules/night-text.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';

	interface Props {
		text: string;
		character: Character;
	}

	let { text, character }: Props = $props();
	const segments = $derived(nightTextSegments(text, character));
</script>

<!-- Storyteller night text with TPI's :reminder: and *TOKEN* markup drawn as tokens. -->
<span class="night-text"
	>{#each segments as s, i (i)}{#if s.kind === 'text'}{s.text}{:else if s.kind === 'info'}<ReminderToken
				label={s.label}
				variant="info"
				title="Info token"
			/>{:else}<ReminderToken
				label={s.label}
				type={character.type}
				title={s.label ? undefined : `One of: ${s.options.join(', ')}`}
			/>{/if}{/each}</span
>
