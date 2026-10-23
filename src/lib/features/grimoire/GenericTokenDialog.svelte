<script lang="ts">
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import GenericLookFields from './GenericLookFields.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * One of the bank's reusable ∞ tokens (plan B9, Trevor 2026-10-23: "Tokens only"): its
	 * symbol, colour and text, which every copy pulled from it starts with. Changing it leaves
	 * the copies already placed as they are.
	 */
	interface Props {
		grimoire: Grimoire;
		open?: boolean;
		tokenId?: string;
	}

	let { grimoire, open = $bindable(false), tokenId }: Props = $props();

	const token = $derived(grimoire.game.genericTokens?.find((t) => t.tokenId === tokenId));
	// Gone (deleted, undone): nothing left to show.
	$effect(() => {
		if (open && !token) open = false;
	});

	function set(change: GenericLook) {
		if (!token) return;
		const { tokenId: id, ...look } = token;
		grimoire.run({ type: 'SetGenericToken', tokenId: id, look: { ...look, ...change } });
	}
</script>

<Dialog bind:open title="∞ token">
	{#snippet heading()}
		<ReminderToken label={(token?.note || '∞') as ReminderLabel} /> token
	{/snippet}
	{#if token}
		{#key token.tokenId}
			<GenericLookFields
				look={token}
				onNote={(note) => set({ note: note || undefined })}
				onSymbol={(symbol) => set({ symbol: symbol || undefined })}
				onColour={(symbolColour) => set({ symbolColour })}
				onFill={(fill) => set({ symbolFill: fill || undefined })}
			/>
		{/key}
	{/if}
	{#snippet headActions()}
		<DeleteButton
			label="Delete token"
			onclick={() => {
				if (token) grimoire.run({ type: 'RemoveGenericToken', tokenId: token.tokenId });
				open = false;
			}}
		/>
	{/snippet}
</Dialog>
