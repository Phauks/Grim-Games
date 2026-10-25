<script lang="ts">
	import JoinPanel from '#lib/features/room/JoinPanel.svelte';
	import { lastRoom } from '#lib/features/room/player.svelte.ts';

	/**
	 * The live room on /play (plan J12, Trevor 2026-10-23: no Room tab): Join game's code form
	 * until the phone is in a room, then one "You" row over the tabs. The room's link and join
	 * code are the page's own Share, as on the board's Script (plan J20).
	 */
	interface Props {
		/**
		 * The room a join link named; null for Join game's code form; left out, the room this
		 * phone last joined, shown only while the phone is in it.
		 */
		initialCode?: string | null;
		/** A typed code was entered; without it the panel switches rooms in place. */
		onCode?: (code: string) => void;
	}

	let { initialCode, onCode }: Props = $props();
	// svelte-ignore state_referenced_locally
	let code = $state(initialCode === undefined ? lastRoom() : (initialCode ?? undefined));
</script>

{#key code}
	<JoinPanel
		{code}
		onCode={(c) => (onCode ? onCode(c) : (code = c))}
		entry={initialCode !== undefined}
	/>
{/key}
