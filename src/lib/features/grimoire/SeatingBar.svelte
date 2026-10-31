<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { playersDialog } from '#lib/features/room/players-dialog.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { letPhonesMove } from './seating-mode.svelte.ts';

	/**
	 * The Seating mode's bar (seating-mode.svelte.ts; Trevor, 2026-10-31), in the reminder bank's
	 * token row, so the board keeps its size and the bank's run button its place: whether
	 * players move their seats from their phones (Open seating), and Count off. With no room
	 * open both stay, disabled, so nothing moves when one opens.
	 */
	const host = roomHost();
	const count = $derived(host.countOff);

	function countOff() {
		if (!count) host.send({ type: 'count-off' });
		playersDialog.countOff = true;
	}
</script>

<div class="seating-bar" data-testid="seating-bar">
	<div class="phones">
		<Toggle
			label={t('room.seating.phones')}
			checked={host.seatingOpen}
			disabled={!host.code}
			onChange={letPhonesMove}
		/>
	</div>
	<Button variant="quiet" icon="countOff" disabled={!host.code} onclick={countOff}>
		{t('room.countOff.title')}
		{#if count}<CountBadge count={count.tokens.length} total={count.size} />{/if}
	</Button>
</div>

<style>
	/* In the bank's token row (ReminderBank's `instead`), beside its run button. */
	.seating-bar {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-width: 0;
		height: 100%;
		padding: 0 var(--space-3);
		box-sizing: border-box;
	}
	.phones {
		min-width: 0;
	}
</style>
