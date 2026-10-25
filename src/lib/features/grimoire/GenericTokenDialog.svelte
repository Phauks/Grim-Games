<script lang="ts">
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import GenericLookFields from './GenericLookFields.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * One of the bank's reusable ∞ tokens (plan B9, Trevor 2026-10-23: "Tokens only"): its
	 * symbol, colour and text, which every copy pulled from it starts with. Changing it leaves
	 * the copies already placed as they are. Two panes (Trevor, 2026-10-24): the token as it
	 * will look on the left, its fields on the right; on a phone the token stays on top.
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

	// The text as typed, so the preview shows it before Enter saves it.
	let text = $state('');
	let width = $state(0);
	// Large enough to read, small enough to leave the fields room under it on a phone.
	const size = $derived(Math.round(Math.min(width * 0.5, 128)));

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
	{#snippet aside()}
		<div
			class="preview"
			bind:clientWidth={width}
			aria-hidden="true"
			data-testid="generic-token-preview"
		>
			{#if token && size > 0}
				<BoardReminder
					label={text.trim() as ReminderLabel}
					character={undefined}
					infinite
					symbol={token.symbol}
					symbolColour={token.symbolColour}
					symbolFill={token.symbolFill}
					{size}
					disabled
					onTap={() => {}}
				/>
			{/if}
		</div>
	{/snippet}
	{#if token}
		{#key token.tokenId}
			<GenericLookFields
				look={token}
				bind:text
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

<style>
	/* One card look for every preview, as Settings' (SettingGroup). */
	.preview {
		display: grid;
		place-items: center;
		min-height: 100%;
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
</style>
