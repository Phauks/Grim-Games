<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import RoomVote from '#lib/features/room/RoomVote.svelte';
	import { pickFromVote, type VotePick } from '#lib/features/room/vote-pick.ts';
	import Page from '#lib/ui/layout/Page.svelte';

	/** Play goes back to New game with the winner chosen. */
	function play(pick: VotePick) {
		pickFromVote(pick);
		void goto(resolve('/new'));
	}
</script>

<svelte:head>
	<title>Room vote · {APP_NAME}</title>
</svelte:head>

<Page title="Room vote">
	<ErrorBoundary area="grimoire">
		<RoomVote onPlay={play} onBack={() => void goto(resolve('/new'))} />
	</ErrorBoundary>
</Page>
