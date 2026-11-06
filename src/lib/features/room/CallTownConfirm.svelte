<script lang="ts">
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TIMER_SOUNDS } from '#lib/ui/preferences.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';

	/**
	 * Back to town, confirmed first (Trevor, 2026-10-27: a Cancel/Confirm sheet), since every
	 * phone in the room sounds and a stray tap can't be taken back. Confirmed, it calls the
	 * town (plan U2) and stops the day timer; players' phones then show Town, the sun set.
	 * The sound every phone plays is picked here and kept for the next call (Trevor, 2026-11-06:
	 * phones have no choice of their own); it never plays on this device, the Storyteller's
	 * (2026-10-30).
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	function call(): void {
		// The day timer stops either way (Trevor, 2026-11-02: always available); without phones
		// in a room to reach, it says so.
		if (liveDayTimer.running) liveDayTimer.toggle();
		if (!roomHost().callTown(preferences.current.townCallSound)) toast(t('room.callTownFailed'));
	}
</script>

<ConfirmDialog bind:open title={t('room.callTownConfirm')} onConfirm={call}>
	<div class="body">
		<p>{t('room.callTownWhat')}</p>
		<Select
			label={t('room.callTownSound')}
			value={preferences.current.townCallSound}
			options={TIMER_SOUNDS.map((value) => ({ value, label: t(`day.timerSound.${value}`) }))}
			onChange={(townCallSound) => preferences.update({ townCallSound })}
		/>
	</div>
</ConfirmDialog>

<style>
	.body {
		display: grid;
		gap: var(--space-4);
	}
	.body p {
		margin: 0;
	}
</style>
