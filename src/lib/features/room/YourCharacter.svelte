<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Character, type PlayerName } from '#lib/core/data/index.ts';
	import type { SeatRole } from '#lib/core/sync/seat-roles.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import HoldToSee from '#lib/ui/primitives/HoldToSee.svelte';
	import { noLongPress } from '#lib/ui/no-long-press.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import VoteChoice from './VoteChoice.svelte';

	/**
	 * The player's own character on their phone (Trevor, 2026-10-26: "Storyteller tells people
	 * they can see it on their screen. It becomes a hold to see."). The button has its own row,
	 * always there and disabled until the Storyteller lets players see theirs, so turning it on
	 * or off moves nothing (Trevor, 2026-10-28). The first hold tells the Storyteller it was seen.
	 * The Storyteller's player view has the same row (Trevor, 2026-10-30): it asks which seat
	 * first, then shows that seat's card as its phone does.
	 */
	interface SeatChoice {
		seatId: string;
		seatNumber: number;
		name?: PlayerName;
		role?: SeatRole;
	}
	interface Props {
		/** This phone's own role, while players may see theirs. */
		role?: SeatRole;
		/** The game's script characters, before the official ones. */
		characters?: readonly Character[];
		/** The first hold of a role, to tell the Storyteller. */
		onSeen?: () => void;
		/** The Storyteller's player view: every seat, while players may see theirs. */
		seats?: readonly SeatChoice[];
	}

	let { role: own, characters, onSeen, seats }: Props = $props();

	/** The seat the Storyteller chose to see as. */
	let chosen = $state<string>();
	const role = $derived(seats ? seats.find((s) => s.seatId === chosen)?.role : own);
	const character = $derived.by(() => {
		const id = role?.characterId;
		if (!id) return undefined;
		return (
			characters?.find((c) => c.id === id) ??
			officialData.current?.characters.find((c) => c.id === id)
		);
	});
	/** Only an alignment: "You are Evil" (a Traveller with no character to draw). */
	const alignmentOnly = $derived(!!role && !role.characterId);
	const alignment = $derived(
		role?.alignment ?? (character ? defaultAlignment(character.type) : undefined)
	);

	let open = $state(false);
	let picking = $state(false);
	let held = $state(false);
	let told = '';
	$effect(() => {
		if (!open) held = false;
	});
	// The role is taken back: its sheet closes with it.
	$effect(() => {
		if (!role) open = false;
	});
	$effect(() => {
		if (seats && !seats.some((s) => s.role)) picking = false;
	});
	function onhold(on: boolean) {
		const key = JSON.stringify(role);
		if (!on || told === key) return;
		told = key;
		onSeen?.();
	}
	function pick(seatId: string) {
		chosen = seatId;
		picking = false;
		open = true;
	}
</script>

<div class="open">
	<Button
		aria-haspopup="dialog"
		data-testid="your-character"
		disabled={seats ? !seats.some((s) => s.role) : !role}
		onclick={() => (seats ? (picking = true) : (open = true))}>{t('room.role.open')}</Button
	>
</div>

{#if seats}
	<Dialog bind:open={picking} title={t('room.role.open')}>
		<ul class="seats" data-testid="role-seats">
			{#each seats as seat (seat.seatId)}
				<li>
					<VoteChoice
						mark={seat.seatNumber}
						pressed={false}
						disabled={!seat.role}
						onclick={() => pick(seat.seatId)}
						>{#if seat.name}<PlayerBadge name={seat.name} />{:else}{t('common.seat', {
								number: seat.seatNumber
							})}{/if}</VoteChoice
					>
				</li>
			{/each}
		</ul>
	</Dialog>
{/if}

<Dialog bind:open title={t('room.role.open')}>
	<div class="role" data-testid="role-card" {@attach noLongPress}>
		<HoldToSee
			label={t('setup.reveal.hold')}
			testid="role-hold"
			bind:held
			preload={[character && iconUrl(character)]}
			{onhold}
		>
			{#if character}
				<CharacterToken {character} size={160} />
			{:else}
				<span class="alignment-face" data-alignment={alignment}
					>{alignment === 'evil' ? t('room.role.evil') : t('room.role.good')}</span
				>
			{/if}
		</HoldToSee>
		<!-- The name, ability and alignment are laid out while hidden, so seeing them moves
		     nothing (Trevor, 2026-10-28: "there is reflow when revealing character"). -->
		<p class="name" class:secret={!held} aria-hidden={!held} data-testid="role-name">
			{#if character}<CharacterBadge
					characterId={character.id}
					{character}
					{alignment}
					interactive={false}
				/>{/if}
		</p>
		<p class="ability" class:secret={!held} aria-hidden={!held} data-testid="role-ability">
			{character?.ability ?? ''}
		</p>
		<!-- An alignment the player is told (a Traveller's, or one the Storyteller chose). -->
		<p class="told" class:secret={!held} aria-hidden={!held} data-testid="role-alignment">
			{role?.alignment && !alignmentOnly
				? role.alignment === 'evil'
					? t('room.role.evil')
					: t('room.role.good')
				: ''}
		</p>
		<!-- Before and while the character shows (Trevor, 2026-10-27). -->
		<FairPlayNotice kind="secret" />
	</div>
</Dialog>

<style>
	.open {
		display: grid;
		margin-bottom: var(--space-2);
	}
	.secret {
		visibility: hidden;
	}
	.seats {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.role {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		text-align: center;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
	}
	.alignment-face {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: calc(10 * var(--u));
		height: calc(10 * var(--u));
		padding: var(--space-3);
		border-radius: 50%;
		background: var(--good);
		color: var(--on-good);
		font-family: var(--font-heading);
		font-size: 1.3rem;
	}
	.alignment-face[data-alignment='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.name {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		margin: 0;
		font-size: 1.3rem;
	}
	.told {
		min-height: 1.4em;
		margin: 0;
		font-weight: 600;
	}
	.ability {
		min-height: 2.6em;
		max-width: 28rem;
		margin: 0;
		font-family: var(--font-ability);
	}
</style>
