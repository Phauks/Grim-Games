<script lang="ts">
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';

	/**
	 * Deleting one of the ∞ tokens of the Storyteller's bank or a player's tray (Trevor,
	 * 2026-11-10, option B): the token, and whether its copies still on the seats go too. With
	 * none out, only Cancel and Confirm.
	 */
	interface Props {
		open?: boolean;
		/** The token being deleted. */
		look: GenericLook | undefined;
		/** How many of its copies are on the seats (`looksLike`). */
		copies: number;
		onConfirm: (withCopies: boolean) => void;
	}

	let { open = $bindable(false), look, copies, onConfirm }: Props = $props();

	let withCopies = $state(true);
	$effect.pre(() => {
		if (open) withCopies = true;
	});
</script>

<ConfirmDialog
	bind:open
	title="Delete token"
	danger
	onConfirm={() => onConfirm(copies > 0 && withCopies)}
>
	{#if look}
		<div class="token">
			<BoardReminder
				label={(look.note ?? '') as ReminderLabel}
				character={undefined}
				infinite
				symbol={look.symbol}
				symbolColour={look.symbolColour}
				symbolFill={look.symbolFill}
				disabled
				onTap={() => {}}
			/>
		</div>
	{/if}
	<Toggle
		label={`Also off seats (${copies})`}
		checked={copies > 0 && withCopies}
		disabled={copies === 0}
		onChange={(checked) => (withCopies = checked)}
	/>
</ConfirmDialog>

<style>
	.token {
		display: grid;
		place-items: center;
		padding-block: var(--space-2);
	}
</style>
