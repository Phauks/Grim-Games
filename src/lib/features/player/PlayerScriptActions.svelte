<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import { shareTargetFor, type Shareable } from '#lib/features/scripts/share-codes.ts';
	import SheetBackgroundSelect from './SheetBackgroundSelect.svelte';
	import PrintScriptButton from './PrintScriptButton.svelte';
	import YouButton from '#lib/features/room/YouButton.svelte';
	import MessageButton from '#lib/features/room/MessageButton.svelte';

	/**
	 * The light background switch, Print, Share and the player's settings cog: /play's title
	 * line, and the Script the Storyteller opens from the board, which matches it exactly
	 * (Trevor, 2026-10-19; the cog too, 2026-10-26: "This should always be parity and invoke
	 * same parts so we don't have to rebuild"). Before a script is loaded only the cog shows:
	 * there is nothing to print or share yet (Trevor, 2026-10-23), but a phone in a room still
	 * needs its name.
	 */
	interface Props {
		script: LoadedScript | undefined;
		version?: string;
		/** What Share links to; without it Share is shown disabled. */
		share: Shareable | undefined;
		/** The live room this device is in, whose link and join code Share hands on. */
		room?: string;
		/** The room this phone has joined, whose name the cog sets; none on the board. */
		joined?: string;
		/**
		 * The Storyteller's copy of this line (the board's Script, the grim cover's Player view):
		 * every button a phone in `room` has shows here too, without acting as a player of it.
		 */
		storyteller?: boolean;
		/** The game mode and special rules the table plays by, for Print. */
		rules?: readonly PublicRule[];
		/**
		 * Continue game's code form, before this phone is in a room, shows no cog: the app's
		 * sidebar already opens Settings there (Trevor, 2026-10-29).
		 */
		cog?: boolean;
	}

	let {
		script,
		version,
		share,
		room,
		joined,
		storyteller = false,
		rules,
		cog = true
	}: Props = $props();
	const target = $derived.by(() => {
		if (!share) return undefined;
		const from = share;
		return () => shareTargetFor(from, location.origin);
	});
</script>

<!-- A message to the Storyteller, first, while this phone is in a room (Trevor, 2026-10-27). -->
<MessageButton room={storyteller ? room : joined} preview={storyteller} />
<!-- One switch for the Script and Night tabs, beside Print and Share (Trevor, 2026-10-23). -->
{#if script}
	<SheetBackgroundSelect compact />
	<PrintScriptButton {script} {version} {rules} />
	<ShareControl
		what="script"
		title={script.name}
		author={script.meta.author}
		{version}
		logo={scriptLogo(script)}
		{target}
		{room}
	/>
{/if}
{#if cog}<YouButton room={joined} />{/if}
