<script lang="ts">
	import type { Character, ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import GenericLookFields from './GenericLookFields.svelte';

	/**
	 * A generic ∞ token's look (symbol, colour, text) in two panes (Trevor, 2026-10-24): the
	 * token as it will look on the left, its fields on the right; on a phone the token stays on
	 * top. The bank's reusable tokens (GenericTokenDialog) and a player's own generic reminders
	 * (PlayerReminderBin) alike.
	 */
	interface Props {
		open?: boolean;
		/** The token's look; none closes the dialog (deleted, undone). */
		look: GenericLook | undefined;
		/** Changes it, keeping the fields not named. */
		onChange: (change: GenericLook) => void;
		onDelete: () => void;
		deleteLabel: string;
		/** A key for the fields: a new token starts them again. */
		tokenKey?: string;
		/** The character whose reminder it copies, whose art it shows (Trevor, 2026-10-27). */
		art?: Character;
	}

	let {
		open = $bindable(false),
		look,
		onChange,
		onDelete,
		deleteLabel,
		tokenKey,
		art
	}: Props = $props();

	$effect(() => {
		if (open && !look) open = false;
	});

	// The text as typed, so the preview shows it before Enter saves it.
	let text = $state('');
	let width = $state(0);
	// Large enough to read, small enough to leave the fields room under it on a phone.
	const size = $derived(Math.round(Math.min(width * 0.5, 128)));
</script>

<Dialog bind:open title="∞ token">
	{#snippet heading()}
		<ReminderToken label={(look?.note || '∞') as ReminderLabel} /> token
	{/snippet}
	{#snippet aside()}
		<div
			class="preview"
			bind:clientWidth={width}
			aria-hidden="true"
			data-testid="generic-token-preview"
		>
			{#if look && size > 0}
				<BoardReminder
					label={text.trim() as ReminderLabel}
					character={undefined}
					infinite
					symbol={look.symbol}
					symbolColour={look.symbolColour}
					symbolFill={look.symbolFill}
					{art}
					{size}
					disabled
					onTap={() => {}}
				/>
			{/if}
		</div>
	{/snippet}
	{#if look}
		{#key tokenKey}
			<GenericLookFields
				{look}
				bind:text
				onNote={(note) => onChange({ note: note || undefined })}
				onSymbol={(symbol) => onChange({ symbol: symbol || undefined })}
				onColour={(symbolColour) => onChange({ symbolColour })}
				onFill={(fill) => onChange({ symbolFill: fill || undefined })}
			/>
		{/key}
	{/if}
	{#snippet headActions()}
		<DeleteButton
			label={deleteLabel}
			onclick={() => {
				onDelete();
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
