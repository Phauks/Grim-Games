<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { callTown } from './call-town.ts';

	/**
	 * Back to town, confirmed first (Trevor, 2026-10-27: a Cancel/Confirm sheet), since every
	 * phone in the room sounds and a stray tap can't be taken back. Confirmed, it calls the
	 * town (plan U2) and stops the day timer; players' phones then show Town, the sun set.
	 * The sound every phone plays is Back to town's in Settings > Sound (Trevor, 2026-11-19);
	 * it never plays on this device, the Storyteller's (2026-10-30).
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	function call(): void {
		// Without phones in a room to reach, it says so.
		if (!callTown()) toast(t('room.callTownFailed'));
	}
</script>

<ConfirmDialog bind:open title={t('room.callTownConfirm')} onConfirm={call}>
	<p>{t('room.callTownWhat')}</p>
</ConfirmDialog>

<style>
	p {
		margin: 0;
	}
</style>
