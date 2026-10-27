<script lang="ts">
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';

	/**
	 * Back to town, confirmed first (Trevor, 2026-10-27: a Cancel/Confirm sheet), since every
	 * phone in the room sounds and a stray tap can't be taken back. Confirmed, it calls the
	 * town (plan U2) and stops the day timer; players' phones then show Town, the sun set.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	function call(): void {
		if (!roomHost().callTown()) {
			toast(t('room.callTownFailed'));
			return;
		}
		if (liveDayTimer.running) liveDayTimer.toggle();
	}
</script>

<ConfirmDialog bind:open title={t('room.callTownConfirm')} onConfirm={call}>
	<p>{t('room.callTownWhat')}</p>
</ConfirmDialog>
