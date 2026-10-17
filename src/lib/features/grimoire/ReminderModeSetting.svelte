<script lang="ts">
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	/**
	 * Whether reminders are held by their seat or stay where they are dropped (Trevor,
	 * 2026-10-17: "nonsticky mode", telling people what it affects). Turning it on asks first
	 * and lists what changes; turning it off just lays reminders out around their seats again.
	 */
	let confirmOpen = $state(false);

	function choose(mode: 'seat' | 'free') {
		if (mode === 'free') confirmOpen = true;
		else boardLooks.update({ reminders: 'seat' });
	}
</script>

<Select
	label="Reminders"
	value={boardLooks.current.reminders}
	options={[
		{ value: 'seat', label: 'Held by seat' },
		{ value: 'free', label: 'Stay where dropped' }
	]}
	onChange={choose}
/>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Reminders stay where dropped?"
	onConfirm={() => boardLooks.update({ reminders: 'free' })}
>
	<dl class="change">
		<dt>Now</dt>
		<dd>Held by seat, laid out so none overlap</dd>
		<dt>Becomes</dt>
		<dd>Each reminder stays where you drop it</dd>
	</dl>
	<ul class="effects" data-testid="reminder-mode-effects">
		<li>
			A reminder still belongs to one seat: the seat it was dropped on, or its old seat when dropped
			away from every seat. Night suggestions, setup reminders, warnings and History go by that
			seat, not by where the reminder is drawn.
		</li>
		<li>Reminders no longer move with their seat when seats are arranged, added or removed.</li>
		<li>
			Reminders can cover seats, other reminders, the Fabled and Loric and the buttons in the
			middle.
		</li>
		<li>
			Where each reminder sits is kept on this device only, as a share of the board, so a different
			screen shape moves them.
		</li>
	</ul>
</ConfirmDialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
	}
	.change dd {
		margin: 0;
	}
	.effects {
		margin: var(--space-3) 0 0;
		padding-left: 1.2em;
		display: grid;
		gap: var(--space-1);
	}
</style>
