<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ShareCode from '#lib/ui/share/ShareCode.svelte';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { roomHost } from './host.svelte.ts';
	import { roomTransfer } from './room-transfer.svelte.ts';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * Room transfer, the Storyteller's side (Trevor, 2026-10-28), from the board's ⋯ > Session
	 * (Trevor, 2026-10-30: "room transfer should be above end game"): the room code and the
	 * transfer code another device types on Join game (⋯ > Room transfer) to become this room's
	 * Storyteller, for five minutes. Both are here, as the other device needs both (2026-10-30).
	 * Closing it leaves the code working; Stop transfer ends it.
	 */
	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	const host = roomHost();
	const transfer = roomTransfer();
</script>

<Dialog bind:open title={t('room.transfer.title')}>
	<div class="transfer" data-testid="room-transfer">
		<ShareCode
			label={t('room.transfer.roomCode')}
			value={host.code && formatRoomCode(host.code)}
			testid="transfer-room-code"
		/>
		<ShareCode label={t('room.transfer.code')} value={transfer.code} testid="transfer-code" />
		<!-- Always in its place, so the switches below never move. -->
		<div class="time">
			<VoteTimeLeft
				endsAt={host.transfer?.endsAt}
				text={(time) => t('room.transfer.expires', { time })}
				endedText={t('room.transfer.expired')}
				testid="transfer-time"
			/>
		</div>
		<SettingToggle
			label={t('room.transfer.bringGame')}
			checked={transfer.bringGame}
			onChange={(on) => transfer.setBringGame(on)}
		/>
		<SettingToggle
			label={t('room.transfer.joinAsPlayer')}
			checked={transfer.joinAsPlayer}
			onChange={(on) => (transfer.joinAsPlayer = on)}
		/>
		<!-- Co-storytelling's place, kept until it exists (design: room-handoff/design.md). -->
		<SettingToggle
			label={t('room.transfer.keepStorytelling')}
			checked={false}
			disabled
			onChange={() => undefined}
		/>
		<ModalActions
			danger
			disabled={!transfer.code}
			confirmLabel={t('room.transfer.stop')}
			onConfirm={() => {
				transfer.stop();
				open = false;
			}}
		/>
	</div>
</Dialog>

<style>
	.transfer {
		display: grid;
		gap: var(--space-2);
	}
	.time {
		min-height: 1.5em;
	}
</style>
