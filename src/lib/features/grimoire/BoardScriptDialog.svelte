<!--
	The players' screen over the board, exactly as players see it on /play (Trevor,
	2026-10-19): byline, Print, Share and tabs, the settings cog, and the logo and name under
	the buttons (Trevor, 2026-10-26). The board's Script and the grim cover's Player view both
	open it.
-->
<script lang="ts">
	import type { BoardPlayerSource } from '#lib/features/grimoire/board-player-source.ts';
	import BoardPlayerView from '#lib/features/grimoire/BoardPlayerView.svelte';
	import PlayerScriptActions from '#lib/features/player/PlayerScriptActions.svelte';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { storytellerLook } from '#lib/features/room/storyteller-look.svelte.ts';
	import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';
	import { afterPaint } from '#lib/ui/after-paint.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { screenTheme } from '#lib/ui/themes/screen-theme.svelte.ts';
	import { sheetTheme } from '#lib/ui/themes/sheet-backgrounds.ts';

	/** Always the board's one source (BoardPlayerSource), whichever way it was opened. */
	interface Props extends BoardPlayerSource {
		open: boolean;
		/** Where notes and guesses are kept (BoardPlayerView). */
		notebook?: string;
		testid: string;
	}

	let {
		open = $bindable(),
		game,
		script,
		logo,
		room,
		characters,
		layout,
		corner,
		look,
		picture,
		pictureRoom,
		notebook,
		testid
	}: Props = $props();

	const version = $derived(scriptVersion(undefined, script?.meta));
	/** Share links to the saved script when it is the game's, as /play's does (parity). */
	const share = $derived(open && script ? gameShareable(script) : undefined);
	/** The game mode and special rules, as the Script below lists them, for Print. */
	const rules = $derived(open ? gameSheetRules(game.gameId) : []);
	/**
	 * The player view is built just after the dialog's first frame paints, so the Script tap
	 * answers at once; building it in the tap held the next paint for 300 ms on a phone (Chrome's
	 * INP reading, Trevor 2026-10-31). The dialog fades in over that frame, so nothing jumps.
	 * Set back before each opening renders (pre), and left alone on closing, so the view stays
	 * while the dialog fades out.
	 */
	let painted = $state(false);
	$effect.pre(() => {
		if (!open) return;
		painted = false;
		return afterPaint(() => (painted = true));
	});
	// The whole player view takes the sheet background while it is open, as /play does
	// (PlayerView), so its tabs, title line and dialogs match, not the Script tab alone (Trevor,
	// 2026-10-30: "Theme not working everywhere. Player view within storyteller view").
	$effect.pre(() => {
		if (!open) return;
		return screenTheme.show(sheetTheme(playerSettings.current.sheetBackground, preferences.theme));
	});
</script>

{#snippet logoLead()}<ScriptName name={game.script.meta?.name} {logo} size="lead" />{/snippet}
<Dialog
	bind:open
	title={game.script.meta?.name || 'Script'}
	size="max"
	titleBelow
	page
	lead={logo ? logoLead : undefined}
>
	{#snippet headActions()}
		<PlayerScriptActions {script} {version} {share} {room} {rules} storyteller />
	{/snippet}
	{#snippet subtitle()}
		<ScriptByline
			author={script?.meta.author}
			{version}
			storyteller={game.storytellerName}
			profile={room ? { roomCode: room, look: storytellerLook(room) } : undefined}
			inline
		/>
	{/snippet}
	<!-- A max-size dialog doesn't scroll itself: its content does. -->
	<div class="script-scroll" data-testid={testid}>
		{#if script && painted}
			<!-- Every screen a player has, Grim and Notes too (Trevor, 2026-10-23: "feature
			     parity"): the town as the table knows it, and the Storyteller's own notes. -->
			<BoardPlayerView
				{game}
				{script}
				{characters}
				{layout}
				{corner}
				{look}
				{picture}
				{pictureRoom}
				{notebook}
			/>
		{/if}
	</div>
</Dialog>

<style>
	/* Out into the dialog's padding, with that room given back inside, so the players' sheets
	   can reach into it as they do into /play's gutter (PlayerScriptTabs) without being
	   clipped by this scroll box, and the bottom tab bar meets the dialog's sides as it meets
	   the screen's on /play. */
	.script-scroll {
		/* The status row sits the dialog's side padding under the byline (PlayerStatusRow). */
		--player-status-gap: var(--space-4);
		flex: 1;
		min-height: 0;
		margin-inline: calc(-1 * var(--space-4));
		padding-inline: var(--space-4);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
