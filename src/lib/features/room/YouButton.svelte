<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextSizeRows from '#lib/features/settings/sections/TextSizeRows.svelte';
	import DensityRow from '#lib/features/player/DensityRow.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';

	/**
	 * The player screen's own settings (plan E2, Trevor 2026-10-26: "easier access to
	 * accessibility, zoom, font size for players. Move name into an edit button in the top";
	 * then "a settings cog in player script view where they select various text sizes settings
	 * and their name"): a cog at the top of the page with this phone's name in its room beside
	 * it, opening one sheet with that name, then Text size, Pinch to zoom and the Script sheet's
	 * density, which change the page at once, as in Settings > Text and Settings > Player.
	 */
	interface Props {
		/** The room this phone is in; without one there is no name to set. */
		room?: string;
	}

	let { room }: Props = $props();
	let open = $state(false);

	let player = $state.raw<RoomPlayer>();
	$effect(() => {
		if (!room) return;
		const p = useRoom(room);
		player = p;
		return () => {
			releaseRoom(p);
			player = undefined;
		};
	});

	/** The name this phone shows in the room, once it has one. */
	const me = $derived(player?.view?.me.name);
	let name = $state('');
	// Filled each time the sheet opens, from the room's name for this phone; a view arriving
	// later must not wipe a name being typed.
	$effect(() => {
		if (open) name = untrack(() => player?.view?.me.name ?? player?.savedName ?? '');
	});
	/** Saving the same name again changes nothing. */
	const unchanged = $derived(!!player?.view && name.trim() === player.view.me.name);

	/** Sends the name; a seated player keeps their seat, and a new one waits to be seated. */
	function save(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n || !player) return;
		player.setName(n);
		open = false;
	}
</script>

<!-- The cog, with the name it shows in the room, or "Settings" before it has one. -->
<Button
	variant="quiet"
	icon="settings"
	aria-haspopup="dialog"
	aria-label={me ? t('room.yourSettingsNamed', { name: me }) : t('room.yourSettings')}
	data-testid="you-button"
	onclick={() => (open = true)}><span class="name">{me || t('settings.title')}</span></Button
>

<Dialog bind:open title={t('room.yourSettings')}>
	<form onsubmit={save}>
		{#if player}
			<label for="player-name">{t('room.yourName')}</label>
			<ClearableField bind:value={name}>
				<input
					id="player-name"
					bind:value={name}
					maxlength="40"
					autocomplete="nickname"
					enterkeyhint="done"
					onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
				/>
			</ClearableField>
		{/if}
		<div class="rows"><TextSizeRows /><DensityRow /></div>
		{#if player}
			<ModalActions
				onCancel={() => (open = false)}
				submit
				disabled={!name.trim() || unchanged || player.status !== 'open'}
				confirmLabel={t('common.save')}
			/>
		{/if}
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	/* A long name never widens the line: it ends in an ellipsis. */
	.name {
		display: inline-block;
		vertical-align: bottom;
		max-width: calc(10 * var(--u));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rows {
		display: grid;
		min-width: 0;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
	}
</style>
