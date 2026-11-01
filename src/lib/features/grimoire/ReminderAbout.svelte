<!--
	A reminder's own dialog (Trevor, 2026-10-30), the Storyteller's (BankReminderDialog) and a
	player's (PlayerReminderBin) alike: the token itself as its heading, whose it is, what its
	holder adds, and the ability it comes from, as the Script tab shows the character.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open?: boolean;
		/** The token, as the board draws it; none while there is nothing to show. */
		token?: Snippet;
		/** Where a placed one lies (on a Fabled, loose), under the token. */
		subtitle?: Snippet;
		/** The character whose ability it comes from; none for an ∞ token. */
		owner?: Character;
		/** The script's character names, linked in the ability. */
		scriptNames: readonly string[];
		/** Before the ability: a setup suggestion's reason, a note's fields. */
		children?: Snippet;
		headActions?: Snippet;
	}

	let {
		open = $bindable(false),
		token,
		subtitle,
		owner,
		scriptNames,
		children,
		headActions
	}: Props = $props();
</script>

<Dialog bind:open title="About this reminder" {subtitle} {headActions}>
	<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
	{#snippet heading()}
		{#if token}{@render token()}{:else}About this reminder{/if}
	{/snippet}
	{@render children?.()}
	<!-- The ability it comes from, as the Script tab shows the character (Trevor, 2026-10-30). -->
	{#if owner}<CharacterRow character={owner} info
			>{#snippet ability()}<GlossaryText
					text={owner.ability}
					names={[...scriptNames]}
				/>{/snippet}</CharacterRow
		>{/if}
</Dialog>
