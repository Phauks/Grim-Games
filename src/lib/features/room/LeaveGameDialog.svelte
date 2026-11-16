<script module lang="ts">
	export interface LeaveCard {
		name: string | undefined;
		logo?: string;
		/** What it is: its stage and seats, room code or town. */
		line: string;
		/** What stays, said plainly. */
		when: string;
	}
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ResumeGameRow from './ResumeGameRow.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	/**
	 * Leaving a game in progress, for the Storyteller, a player in a room and a players-only
	 * town alike (Trevor, 2026-11-06, mockup D): the question and the game as Join game shows
	 * it, the thing that will be waiting there. Cancel is the only way to stay, so no ✕.
	 */
	interface Props {
		open?: boolean;
		title: string;
		card: LeaveCard;
		/**
		 * A room's game: a Leave the room switch, off to start with, so a player or spectator
		 * can leave the room too rather than stay on in it (Trevor, 2026-11-16, option A).
		 * `onConfirm` hears whether it was on.
		 */
		room?: boolean;
		onConfirm: (leaveRoom: boolean) => void;
	}

	let { open = $bindable(false), title, card, room = false, onConfirm }: Props = $props();
	let leaveRoom = $state(false);
	const shown = $derived(room && leaveRoom ? { ...card, when: t('shell.leave.roomGone') } : card);
	// Each time it opens, the switch starts off: staying in the room is the usual way out.
	$effect(() => {
		if (open) leaveRoom = false;
	});
</script>

<ConfirmDialog bind:open {title} closeButton={false} onConfirm={() => onConfirm(room && leaveRoom)}>
	<ResumeGameRow {...shown} testid="leave-game-card" />
	{#if room}<Toggle
			label={t('shell.leave.roomToggle')}
			checked={leaveRoom}
			onChange={(on) => (leaveRoom = on)}
		/>{/if}
</ConfirmDialog>
