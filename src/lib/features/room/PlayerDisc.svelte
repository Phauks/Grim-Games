<script lang="ts">
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';

	export type Phone = 'here' | 'away' | 'none';

	/**
	 * A player's seat and phone in one disc, on the Players list (Trevor, 2026-11-01: "keep
	 * the amount of information, but not as much space"): their avatar while their phone is
	 * here, dimmed with a moon while it is away, a dashed ring with no phone; the seat number
	 * on its corner (in the ring itself with no phone). It is a picture, not a control: the row
	 * around it is what is tapped.
	 */
	interface Props {
		/** 1-based seat number, or none for a phone with no seat. */
		seat?: number;
		name: PlayerName;
		phone: Phone;
		avatar?: AvatarId;
		picture?: string;
	}

	let { seat, name, phone, avatar = 'initials', picture }: Props = $props();
	const PHONE_TEXT = {
		here: 'room.players.here',
		away: 'room.players.away',
		none: 'room.players.noPhone'
	} as const;
</script>

<span
	class="disc"
	data-testid="room-player-phone"
	data-phone={phone}
	role="img"
	aria-label={t('room.players.phone', { state: t(PHONE_TEXT[phone]) })}
	title={t(PHONE_TEXT[phone])}
>
	{#if phone === 'none'}<span class="ring"></span>{:else}<span class="face"
			><AvatarFace {avatar} {name} {picture} /></span
		>{/if}
	{#if seat}<span class="num">{seat}</span>{/if}
	{#if phone === 'away'}<span class="away"><Icon name="phoneAway" /></span>{/if}
</span>

<style>
	.disc {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: calc(2.25 * var(--u));
		height: calc(2.25 * var(--u));
	}
	.face,
	.ring {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
	}
	.face {
		display: grid;
	}
	.disc[data-phone='away'] .face {
		opacity: 0.45;
	}
	.ring {
		box-sizing: border-box;
		border: 0.0625rem dashed var(--on-surface-muted);
		border-radius: 50%;
	}
	/* The seat number on the face's lower left; inside the ring when there is no face. */
	.num {
		position: absolute;
		bottom: -0.2em;
		left: -0.25em;
		display: grid;
		place-items: center;
		min-width: 1.35em;
		height: 1.35em;
		padding: 0 0.2em;
		box-sizing: border-box;
		border: 0.0625rem solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface);
		color: var(--on-surface);
		font-size: 0.75rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.disc[data-phone='none'] .num {
		inset: 0;
		margin: auto;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.away {
		position: absolute;
		right: -0.3em;
		bottom: -0.2em;
		display: grid;
		place-items: center;
		width: 1.2em;
		height: 1.2em;
		border-radius: 50%;
		background: var(--surface);
		color: var(--on-surface-muted);
		font-size: 0.75rem;
	}
</style>
