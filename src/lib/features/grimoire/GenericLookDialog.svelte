<script lang="ts">
	import type { Character, ReminderLabel } from '#lib/core/data/index.ts';
	import type { CounterTime } from '#lib/core/data/parts/counter.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import GenericLookFields from './GenericLookFields.svelte';

	/**
	 * A generic ∞ token's look (text, symbol, colour), the token as it will look beside its
	 * text, all on one phone screen with the keyboard up (Trevor, 2026-11-10, option B). The
	 * bank's reusable tokens (GenericTokenDialog) and a player's own generic reminders
	 * (PlayerReminderBin) alike. Changes wait for Confirm (Trevor, 2026-11-10, option B);
	 * Cancel, ✕ or Escape leave the token as it was, and a token just made goes again.
	 */
	interface Props {
		open?: boolean;
		/** The token's look; none closes the dialog (deleted, undone). */
		look: GenericLook | undefined;
		/** Changes it on Confirm, keeping the fields not named. */
		onChange: (change: GenericLook) => void;
		onDelete: () => void;
		deleteLabel: string;
		/** A key for the fields: a new token starts them again. */
		tokenKey?: string;
		/** The character whose reminder it copies, whose art it shows (Trevor, 2026-10-27). */
		art?: Character;
		/** A # token's Counts up (GenericLookFields); left out, the row isn't offered. */
		onCountsUp?: (countsUp: CounterTime | undefined) => void;
		/** Just made by "+ New token": closing without Confirm deletes it. */
		fresh?: boolean;
		/** After Confirm has saved it (a new token goes into the hand). */
		onConfirm?: () => void;
		/**
		 * ⋯ Duplicate (Trevor, 2026-11-10): a new token with the look as it stands here, saved
		 * first. Left out, ⋯ has only the delete row.
		 */
		onDuplicate?: (look: GenericLook) => void;
		/** The script's characters: the Characters tab's icons (GenericLookFields). */
		scriptCharacters?: readonly Character[];
	}

	let {
		open = $bindable(false),
		look,
		onChange,
		onDelete,
		deleteLabel,
		tokenKey,
		art,
		onCountsUp,
		fresh = false,
		onConfirm,
		onDuplicate,
		scriptCharacters = []
	}: Props = $props();

	$effect(() => {
		if (open && !look) open = false;
	});

	/** The look as changed so far, saved on Confirm. */
	let draft = $state<GenericLook>({});
	let confirmed = false;
	let wasOpen = false;
	$effect.pre(() => {
		if (open && !wasOpen) {
			draft = { ...look };
			confirmed = false;
		}
		if (!open && wasOpen && !confirmed && fresh) onDelete();
		wasOpen = open;
	});

	// The text as typed, so the preview shows it before Enter saves it.
	let text = $state('');
	let width = $state(0);
	const size = $derived(Math.round(width));
	let fields = $state<HTMLElement>();

	/**
	 * A ⋯ row's work, just after the menu has closed: closing the dialog from inside zag's
	 * select crashes Svelte (null batch), as Dialog's `dismissedByParent` says.
	 */
	const after = (work: () => void) => queueMicrotask(work);

	/** The look as it stands, with the text as typed. */
	const current = (): GenericLook => ({ ...draft, note: text.trim() || undefined });

	function confirm() {
		if (!look) return;
		const next = current();
		const change: GenericLook = {};
		for (const key of ['note', 'symbol', 'symbolColour', 'symbolFill'] as const)
			if (next[key] !== look[key]) Object.assign(change, { [key]: next[key] });
		if (Object.keys(change).length > 0) onChange(change);
		if (onCountsUp && next.countsUp !== look.countsUp) onCountsUp(next.countsUp);
		confirmed = true;
		open = false;
		onConfirm?.();
	}
</script>

<Dialog
	bind:open
	title="∞ token"
	initialFocus={() => fields?.querySelector<HTMLElement>('[data-testid="reminder-note"]') ?? null}
>
	{#snippet heading()}
		<ReminderToken label={(look?.note || '∞') as ReminderLabel} /> token
	{/snippet}
	{#if look}
		<div class="fields" bind:this={fields}>
			{#key tokenKey}
				<GenericLookFields
					look={draft}
					bind:text
					{scriptCharacters}
					onNote={(note) => (draft = { ...draft, note: note || undefined })}
					onSymbol={(symbol) => (draft = { ...draft, symbol: symbol || undefined })}
					onColour={(symbolColour) => (draft = { ...draft, symbolColour })}
					onFill={(fill) => (draft = { ...draft, symbolFill: fill || undefined })}
					onCountsUp={onCountsUp && ((countsUp) => (draft = { ...draft, countsUp }))}
					onEnter={confirm}
				>
					{#snippet lead()}
						<div
							class="preview"
							bind:clientWidth={width}
							aria-hidden="true"
							data-testid="generic-token-preview"
						>
							{#if size > 0}
								<BoardReminder
									label={text.trim() as ReminderLabel}
									character={undefined}
									infinite
									symbol={draft.symbol}
									symbolColour={draft.symbolColour}
									symbolFill={draft.symbolFill}
									{art}
									{size}
									disabled
									onTap={() => {}}
								/>
							{/if}
						</div>
					{/snippet}
				</GenericLookFields>
			{/key}
		</div>
	{/if}
	{#snippet headActions()}
		<Menu
			label="More token actions"
			items={[
				...(onDuplicate
					? [
							{
								value: 'duplicate',
								label: 'Duplicate',
								onSelect: () => {
									const look = current();
									after(() => {
										confirm();
										onDuplicate(look);
									});
								}
							}
						]
					: []),
				{
					value: 'delete',
					label: deleteLabel,
					onSelect: () =>
						after(() => {
							confirmed = true;
							onDelete();
							open = false;
						})
				}
			]}
		/>
	{/snippet}
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={confirm} />
	{/snippet}
</Dialog>

<style>
	/* Beside the text, as tall as its label and field together. */
	.preview {
		flex: none;
		width: calc(1.75 * var(--tap-target));
		display: grid;
		place-items: center;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
