<script lang="ts">
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TOWN_CALL_SOUNDS, type TownCallSound } from '#lib/ui/preferences.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';

	/**
	 * Back to town, confirmed first (Trevor, 2026-10-27: a Cancel/Confirm sheet), since every
	 * phone in the room sounds and a stray tap can't be taken back. Confirmed, it calls the
	 * town (plan U2) and stops the day timer; players' phones then show Town, the sun set.
	 * The sound to send is picked here and kept for the next call (Trevor, 2026-11-06); it never
	 * plays on this device, the Storyteller's (2026-10-30).
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	const soundLabel = (sound: TownCallSound) =>
		sound === 'own' ? t('room.callTownSound.own') : t(`day.timerSound.${sound}`);

	function call(): void {
		// The day timer stops either way (Trevor, 2026-11-02: always available); without phones
		// in a room to reach, it says so.
		if (liveDayTimer.running) liveDayTimer.toggle();
		const sound = preferences.current.townCallSound;
		if (!roomHost().callTown(sound === 'own' ? undefined : sound)) toast(t('room.callTownFailed'));
	}
</script>

<ConfirmDialog bind:open title={t('room.callTownConfirm')} onConfirm={call}>
	<div class="body">
		<p>{t('room.callTownWhat')}</p>
		<Select
			label={t('room.callTownSound')}
			value={preferences.current.townCallSound}
			options={TOWN_CALL_SOUNDS.map((value) => ({ value, label: soundLabel(value) }))}
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
