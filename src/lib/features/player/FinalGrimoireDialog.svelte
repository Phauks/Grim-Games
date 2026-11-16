<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { SharedGrimoire } from '#lib/core/sync/room.ts';
	import type { EndedGame } from '#lib/features/board/device-notes.ts';
	import SharedBoard from '#lib/features/room/SharedBoard.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The finished grimoire the Storyteller shared (Share grim, plan R5), over the whole screen
	 * so every seat and History's strip show (Trevor, 2026-11-15, option B). The Grim tab keeps
	 * the player's own town under it, guesses and all; closing it shows them again, and the
	 * Final grimoire switch in the grim's corner opens it again.
	 */
	interface Props {
		open: boolean;
		grimoire: SharedGrimoire;
		over?: EndedGame;
		/** The room it came through, which holds the board's background picture. */
		room?: string;
	}

	let { open = $bindable(), grimoire, over, room }: Props = $props();
</script>

<Dialog title={t('room.finalGrimoire')} size="screen" scroll={false} bind:open>
	<div class="final" data-testid="final-grimoire">
		<SharedBoard shared={grimoire} {over} {room} toolbar={false} />
	</div>
</Dialog>

<style>
	.final {
		height: 100%;
	}
</style>
