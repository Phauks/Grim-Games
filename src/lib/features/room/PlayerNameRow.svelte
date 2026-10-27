<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import type { RoomPlayer } from './player.svelte.ts';

	/**
	 * This phone's name in its room, as one setting row: the name and an Edit pencil that opens
	 * a small modal to change it (Trevor, 2026-10-27: "Name is only item in player setting that
	 * uses save. It should be a modal instead to match behaviour of other stuff"). Every other
	 * row in the settings sheet changes at once; only this modal has Save.
	 */
	interface Props {
		player: RoomPlayer;
	}

	let { player }: Props = $props();
	let open = $state(false);

	/** The name this phone shows in the room, once it has one; numbered while another has it. */
	const me = $derived(player.view?.shownAs ?? player.view?.me.name);
	let name = $state('');
	// Filled each time the modal opens; a view arriving later must not wipe a name being typed.
	$effect(() => {
		if (open) name = untrack(() => player.view?.me.name ?? player.savedName ?? '');
	});
	/** Saving the same name again changes nothing. */
	const unchanged = $derived(!!player.view && name.trim() === player.view.me.name);

	/** Sends the name; a seated player keeps their seat, and a new one waits to be seated. */
	function save(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n) return;
		player.setName(n);
		open = false;
	}
</script>

<SettingRow label={t('room.yourName')}>
	{#snippet control(labelId)}
		<span class="value">
			<span class="name" data-testid="player-name"
				>{#if me}<PlayerBadge name={me} />{:else}{t('common.none')}{/if}</span
			>
			<IconButton
				icon="edit"
				label={t('room.editName')}
				aria-haspopup="dialog"
				aria-describedby={labelId}
				onclick={() => (open = true)}
			/>
		</span>
	{/snippet}
</SettingRow>

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
			disabled={!name.trim() || unchanged || player.status !== 'open'}
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
	.value {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		min-width: 0;
	}
	/* A long name ends in "…" rather than widening the row. */
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
