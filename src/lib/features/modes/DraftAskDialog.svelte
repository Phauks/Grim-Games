<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * A question the deal asks about a drafted character before the next tile (a setup change,
	 * a hidden character, a gained ability): it can't be closed without an answer, and the
	 * player may draft again instead, as Grimbits does for a rejected Legion.
	 */
	interface Props {
		open: boolean;
		/** The drafted character the question is about, in the subtitle. */
		character: Character | undefined;
		testid: string;
		/** Undefined when the player can't draft again. */
		onRedraft: (() => void) | undefined;
		children: Snippet;
	}

	let { open = $bindable(), character, testid, onRedraft, children }: Props = $props();
</script>

<Dialog bind:open title={t('modes.deal.askTitle')} closeButton={false} beforeClose={() => false}>
	{#snippet subtitle()}{#if character}<CharacterBadge
				characterId={character.id}
				{character}
			/>{/if}{/snippet}
	<div class="ask" data-testid={testid}>
		{@render children()}
		{#if onRedraft}
			<div class="options">
				<Button icon="undo" onclick={onRedraft}>{t('modes.deal.redraft')}</Button>
			</div>
		{/if}
	</div>
</Dialog>

<style>
	.ask,
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.ask {
		flex-direction: column;
	}
</style>
