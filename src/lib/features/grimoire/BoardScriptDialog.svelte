<!--
	The players' screen over the board, exactly as players see it on /play (Trevor,
	2026-10-19): byline, Print, Share and tabs, the settings cog, and the logo and name under
	the buttons (Trevor, 2026-10-26). The board's Script and the grim cover's Player view both
	open it.
-->
<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import type {
		PublicCorner,
		PublicLook,
		PublicSeatLayout
	} from '#lib/core/sync/public-projection.ts';
	import BoardPlayerView from '#lib/features/grimoire/BoardPlayerView.svelte';
	import PlayerScriptActions from '#lib/features/player/PlayerScriptActions.svelte';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		game: Game;
		/** The game's script, once the official data has loaded. */
		script: LoadedScript | undefined;
		logo: string | undefined;
		/** The live room's code, for Share. */
		room: string | undefined;
		characters: CharacterLookup;
		layout: PublicSeatLayout;
		corner: PublicCorner;
		look?: PublicLook;
		picture?: Blob;
		pictureRoom?: string;
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
</script>

{#snippet logoLead()}<ScriptLogo src={logo} class="title-logo" />{/snippet}
<Dialog
	bind:open
	title={game.script.meta?.name || 'Script'}
	size="max"
	titleBelow
	lead={logo ? logoLead : undefined}
>
	{#snippet headActions()}
		<PlayerScriptActions {script} {version} {share} {room} storyteller />
	{/snippet}
	{#snippet subtitle()}
		<ScriptByline
			author={script?.meta.author}
			{version}
			storyteller={game.storytellerName}
			inline
		/>
	{/snippet}
	<!-- A max-size dialog doesn't scroll itself: its content does. -->
	<div class="script-scroll" data-testid={testid}>
		{#if script}
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
	   clipped by this scroll box. */
	.script-scroll {
		/* The status row sits the dialog's side padding under the byline (PlayerStatusRow). */
		--player-status-gap: var(--space-4);
		flex: 1;
		min-height: 0;
		/* The dialog's side margin, for the space under the tabs (PlayerScriptTabs). */
		--player-side: var(--space-4);
		margin-inline: calc(-1 * var(--space-3));
		padding-inline: var(--space-3);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
