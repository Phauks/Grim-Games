<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import PlayerNameDialog from './PlayerNameDialog.svelte';
	import { playerName, type RoomPlayer } from './player.svelte.ts';

	/**
	 * This phone's name, in its room or (with no room) the one it takes into the next, as one
	 * setting row in the Profile: the name and an Edit pencil that opens
	 * a small modal to change it (Trevor, 2026-10-27: "Name is only item in player setting that
	 * uses save. It should be a modal instead to match behaviour of other stuff"). Every other
	 * row in the settings sheet changes at once; only this modal has Save.
	 */
	interface Props {
		/** The room this phone is in; without one, the name is only kept for the next room. */
		player?: RoomPlayer;
	}

	let { player }: Props = $props();
	let open = $state(false);

	/** The name this phone shows in the room, once it has one; numbered while another has it. */
	const me = $derived(
		player ? (player.view?.shownAs ?? player.view?.me.name) : playerName.current || undefined
	);
</script>

<SettingRow label={t('room.yourName')}>
	{#snippet control(labelId)}
		<span class="value">
			<span class="name" data-testid="player-name"
				>{#if me}<PlayerBadge name={me} />{:else}<NoneState inline />{/if}</span
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

<PlayerNameDialog bind:open {player} />

<style>
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
</style>
