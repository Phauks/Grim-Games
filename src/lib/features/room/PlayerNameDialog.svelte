<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { playerName, type RoomPlayer } from './player.svelte.ts';

	/**
	 * The small modal that sets this phone's name, with Save (Trevor, 2026-10-27: "It should
	 * be a modal instead to match behaviour of other stuff"). The Profile's name row opens it,
	 * and so does count off when a phone with no name taps a number (Trevor, 2026-11-16: "one
	 * person tried clicking the button and it never worked").
	 */
	interface Props {
		open: boolean;
		/** The room this phone is in; without one, the name is only kept for the next room. */
		player?: RoomPlayer;
		/** After the name is sent, for what the player was doing when it was asked for. */
		onSaved?: (name: string) => void;
	}

	let { open = $bindable(), player, onSaved }: Props = $props();

	let name = $state('');
	// Filled each time the modal opens; a view arriving later must not wipe a name being typed.
	$effect(() => {
		if (open) name = untrack(() => player?.view?.me.name ?? playerName.current);
	});
	/** Saving the same name again changes nothing. */
	const unchanged = $derived(
		player?.view
			? name.trim() === player.view.me.name
			: !player && name.trim() === playerName.current
	);

	/** Sends the name; a seated player keeps their seat, and a new one waits to be seated. */
	function save(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n) return;
		if (player) player.setName(n);
		else playerName.set(n);
		open = false;
		onSaved?.(n);
	}
</script>

<Dialog bind:open title={t('room.yourName')}>
	<form onsubmit={save}>
		<ClearableField bind:value={name}>
			<input
				aria-label={t('room.yourName')}
				bind:value={name}
				maxlength="40"
				autocomplete="nickname"
				enterkeyhint="done"
			/>
		</ClearableField>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={!name.trim() || unchanged || (!!player && player.status !== 'open')}
			confirmLabel={t('common.save')}
		/>
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
	}
</style>
