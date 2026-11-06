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
	import ResumeGameRow from './ResumeGameRow.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';

	/**
	 * Leaving a game in progress, for the Storyteller, a player in a room and a players-only
	 * town alike (Trevor, 2026-11-06, mockup D): the question and the game as Join game shows
	 * it, the thing that will be waiting there. Cancel is the only way to stay, so no ✕.
	 */
	interface Props {
		open?: boolean;
		title: string;
		card: LeaveCard;
		onConfirm: () => void;
	}

	let { open = $bindable(false), title, card, onConfirm }: Props = $props();
</script>

<ConfirmDialog bind:open {title} closeButton={false} {onConfirm}>
	<ResumeGameRow {...card} testid="leave-game-card" />
</ConfirmDialog>
