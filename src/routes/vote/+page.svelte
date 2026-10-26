<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import RoomVote from '#lib/features/room/RoomVote.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
</script>

<svelte:head>
	<title>Room vote · {APP_NAME}</title>
</svelte:head>

<Page title="Room vote">
	<ErrorBoundary area="grimoire">
		<RoomVote />
	</ErrorBoundary>
</Page>
