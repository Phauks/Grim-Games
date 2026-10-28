<script lang="ts">
	import { MAX_MESSAGE_LENGTH } from '#lib/core/sync/room-messages.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';

	/**
	 * A player's message to the Storyteller (Trevor, 2026-10-27: "Unilateral messaging to
	 * storyteller"), among the player screen's title icons while the phone is in a room. One
	 * way only, and gone from the phone once sent (Trevor: "Players cannot see message once
	 * sent. Don't want ppl to use info to confirm things"): Send closes the sheet and clears it.
	 * Disabled while the Storyteller's app can't show messages, so nothing is sent unread.
	 */
	interface Props {
		/** The room this phone is in; without one there is no Storyteller to write to. */
		room?: string;
		/**
		 * The Storyteller's own player view of that room: the same button and sheet, but with no
		 * player of the room behind it, so nothing can be sent.
		 */
		preview?: boolean;
	}

	let { room, preview = false }: Props = $props();

	let player = $state.raw<RoomPlayer>();
	$effect(() => {
		if (!room || preview) return;
		const p = useRoom(room);
		player = p;
		return () => {
			releaseRoom(p);
			player = undefined;
		};
	});

	let open = $state(false);
	let text = $state('');
	let failed = $state(false);
	/** Asks the Storyteller for a word in private (Trevor, 2026-10-27: "add a checkmark to request a storyteller consult"); it can go with no text. */
	let consult = $state(false);
	const ready = $derived(!!text.trim() || consult);
	const canSend = $derived(!!player?.view?.inbox);

	function send() {
		if (!ready) return;
		if (!player?.sendMessage(text, consult)) {
			failed = true;
			return;
		}
		text = '';
		consult = false;
		failed = false;
		open = false;
	}
</script>

{#if room}
	<IconButton
		icon="messages"
		aria-haspopup="dialog"
		label={t('room.message.title')}
		disabled={!canSend && !preview}
		data-testid="message-button"
		onclick={() => (open = true)}
	/>
	<Dialog bind:open title={t('room.message.title')}>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				send();
			}}
		>
			<!-- Asked of every player before they write (Trevor, 2026-10-27: "players will not abuse
			     this feature for metagame reasons, or to break the integrity of the game"). -->
			<div class="pledge"><FairPlayNotice kind="message" /></div>
			<TextField
				label={t('room.message.field')}
				bind:value={text}
				multiline
				rows={4}
				maxlength={MAX_MESSAGE_LENGTH}
				testid="message-field"
				oninput={() => (failed = false)}
			/>
			<div class="consult">
				<Toggle
					label={t('room.message.consult')}
					checked={consult}
					onChange={(on) => (consult = on)}
				/>
			</div>
			{#if failed}<p class="failed" role="alert">{t('room.message.failed')}</p>{/if}
		</form>
		{#snippet actions()}
			<ModalActions
				onConfirm={send}
				disabled={!ready || !canSend}
				confirmLabel={t('room.message.send')}
				confirmIcon="messages"
			>
				{#snippet start()}<span class="length"
						><CountBadge count={text.length} total={MAX_MESSAGE_LENGTH} /></span
					>{/snippet}
			</ModalActions>
		{/snippet}
	</Dialog>
{/if}

<style>
	.pledge {
		display: grid;
		justify-items: center;
		margin-bottom: var(--space-3);
	}
	.consult {
		margin-top: var(--space-3);
	}
	.failed {
		margin: var(--space-2) 0 0;
		color: var(--evil);
	}
	.length {
		align-self: center;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>
