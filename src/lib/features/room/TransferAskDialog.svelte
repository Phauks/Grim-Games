<script lang="ts">
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import { roomTransfer } from './room-transfer.svelte.ts';

	/**
	 * Room transfer's consent (Trevor, 2026-10-28: "make it so they have to confirm, so that
	 * someone cannot just take the room without consent from the parent device"): a device with
	 * the right transfer code asks to take over, and the Storyteller's device confirms it, on
	 * any screen of the game. Cancel, ✕ or Escape turns it down.
	 */
	const host = roomHost();
	const transfer = roomTransfer();
	const asking = $derived(host.transfer?.asking);

	let open = $state(false);
	let answered = false;
	$effect(() => {
		open = !!asking;
		if (asking) answered = false;
	});
	// Closed without an answer (✕ or Escape): that is a no.
	$effect(() => {
		if (!open && asking && !answered) answer(false);
	});

	function answer(allow: boolean) {
		answered = true;
		if (!transfer.answer(allow)) toast(t('room.transfer.failed'));
	}
</script>

<ConfirmDialog
	bind:open
	title={t('room.transfer.title')}
	onConfirm={() => answer(true)}
	onCancel={() => answer(false)}
>
	<p class="ask" data-testid="transfer-ask">
		{#if asking?.name}
			<PlayerBadge name={asking.name as PlayerName} />
			{t('room.transfer.asking')}
		{:else}
			{t('room.transfer.askingDevice')}
		{/if}
	</p>
</ConfirmDialog>

<style>
	.ask {
		margin: 0;
	}
</style>
