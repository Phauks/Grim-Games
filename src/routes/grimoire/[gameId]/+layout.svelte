<script lang="ts">
	import TransferAskDialog from '#lib/features/room/TransferAskDialog.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
<!-- Room transfer's question to the Storyteller's device, on every screen of the game. -->
<TransferAskDialog />
