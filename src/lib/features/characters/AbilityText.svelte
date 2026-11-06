<script lang="ts">
	import { splitSetupNote } from '#lib/core/text/setup-note.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import SetupNote from './SetupNote.svelte';

	interface Props {
		/** The character's ability, as its data has it. */
		text: string;
		/** Character names the Glossary must not mark (homebrew). */
		names?: readonly string[];
	}

	let { text, names = [] }: Props = $props();
	const split = $derived(splitSetupNote(text));
	// One block, so a term is marked at its first use across the ability and its note.
	const parts = $derived(explainBlock([split.text, split.setup ?? ''], names));
</script>

<!-- A character's ability with Glossary terms marked, its setup note on a line of its own. -->
<GlossaryText segments={parts[0] ?? []} />{#if split.setup}<SetupNote
		><GlossaryText segments={parts[1] ?? []} /></SetupNote
	>{/if}
