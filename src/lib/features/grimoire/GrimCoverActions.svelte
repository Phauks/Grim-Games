<!--
	On the grim cover, what shows nothing secret (Trevor, 2026-10-27: "calling back to town,
	seeing player view (script, night order, public grim, not notes)"). The dialogs are drawn
	in the cover, over it (GrimoireBoard, DaySheet).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import BoardScriptDialog from '#lib/features/grimoire/BoardScriptDialog.svelte';
	import type { BoardPlayerSource } from '#lib/features/grimoire/board-player-source.ts';
	import { forgetTableNotebook, tableNotebook } from '#lib/features/player/table-notebook.ts';
	import CallTownConfirm from '#lib/features/room/CallTownConfirm.svelte';
	import InboxNotice from '#lib/features/room/InboxNotice.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	interface Props {
		/** Back to town is offered: a live room, and the game not over. */
		callTown: boolean;
		/** The players' screen, from the same source as the board's Script (BoardPlayerSource). */
		view: BoardPlayerSource;
	}

	let { callTown, view }: Props = $props();
	const game = $derived(view.game);

	let callTownOpen = $state(false);
	/** The players' view. */
	let viewOpen = $state(false);
	/** Opens it with the table notebook blank (Trevor, 2026-10-27: "Blank each time"). */
	async function openView() {
		await forgetTableNotebook(game.gameId);
		viewOpen = true;
	}
	// Closed, the table's notes go too, so nothing waits on the device for the next player.
	let viewWasOpen = false;
	$effect(() => {
		if (viewOpen) viewWasOpen = true;
		else if (viewWasOpen) {
			viewWasOpen = false;
			void forgetTableNotebook(untrack(() => game.gameId));
		}
	});
</script>

<InboxNotice />
{#if callTown}
	<!-- Lit once the day's time is up; it never calls by itself (Trevor, 2026-10-27). -->
	<Button
		icon="sound"
		variant={liveDayTimer.done ? 'accent' : 'solid'}
		data-testid="cover-call-town"
		onclick={() => (callTownOpen = true)}
	>
		{t('room.callTown')}
	</Button>
	<CallTownConfirm bind:open={callTownOpen} />
{/if}
{#if view.script}
	<Button icon="script" onclick={openView}>{t('show.playerView')}</Button>
	<!-- The players' screen as it is on /play, its title-line buttons and notes too (Trevor,
	     2026-10-27: "same setting, share, and other buttons ... As if they were within the
	     app. We shouldn't even block notes"); the notes are the table's, blank each time. -->
	<BoardScriptDialog
		bind:open={viewOpen}
		{...view}
		notebook={tableNotebook(game.gameId)}
		testid="cover-player-view"
	/>
{/if}
