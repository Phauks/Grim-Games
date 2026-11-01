<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { roleGaps, seatRoles, type RoleGap } from '#lib/core/sync/seat-roles.ts';
	import type { SeatId, TileId } from '#lib/core/model/index.ts';
	import type { BagSlot } from '#lib/core/rules/index.ts';
	import BagTiles from '#lib/features/setup/BagTiles.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import RoleCard from './RoleCard.svelte';
	import { roomHost } from './host.svelte.ts';
	import { ROLES_SHOWN_MS } from './roles-shown.svelte.ts';
	import { clock, timeLeft } from './time-left.svelte.ts';

	/**
	 * Show players their own characters on their phones (Trevor, 2026-10-26: "Storyteller sees
	 * who has seen their role. Then can turn on and off when ppl can see it"), beside Players'
	 * ✕ (Trevor, 2026-10-31: "put it next to the x button, when clicked the button changes into
	 * the timer which can also be ended very fast"). A button, not a switch (Trevor,
	 * 2026-10-30): showing them starts a minute that runs out on its own, counted down on the
	 * button itself, and one tap on it hides them again. Who has seen theirs is marked on each
	 * player's row (Trevor, 2026-10-30).
	 */
	let { game }: { game: OpenGame } = $props();

	const host = roomHost();
	const gameId = $derived(game.game.gameId);
	const shown = $derived(host.rolesShown.gameId === gameId);
	const countdown = timeLeft(() => (shown ? host.rolesShown.until : undefined));
	// Before it starts, the minute it will run; then what is left of it.
	const time = $derived(clock(countdown.ms ?? ROLES_SHOWN_MS));

	// Who won't see a character, said before showing them (Trevor, 2026-10-31: "should show
	// some information if not all seats are filled, or not all players have assigned
	// characters"). A warning: Confirm shows them anyway.
	const GAP_TEXT = {
		'no-character': 'room.roles.noCharacter',
		withheld: 'room.roles.withheld',
		'no-alignment': 'room.roles.noAlignment',
		'no-phone': 'room.roles.noPhone'
	} as const satisfies Record<RoleGap, string>;
	let warning = $state<{ key: string; name: string; text: string }[]>([]);
	let warn = $state(false);
	// Players with no phone come to the Storyteller for theirs (Trevor, 2026-11-01: "After. On
	// the next screen, make a screen where I see all people who don't have phones and can show
	// it to them in any order"): once shown, a list of them; a tap holds out that one's card
	// on this device, and closing it comes back to the list, the player now marked seen.
	let noPhone = $state<SeatId[]>([]);
	let listOpen = $state(false);
	let cardSeat = $state<SeatId>();
	let cardOpen = $state(false);
	let shownHere = $state<ReadonlySet<SeatId>>(new Set());
	const roles = $derived(seatRoles(game.game, game.characters));
	const scriptCharacters = $derived([...game.characters.values()]);
	const noPhoneSlots = $derived<BagSlot[]>(
		noPhone.map((seatId, i) => ({
			tileId: seatId as unknown as TileId,
			number: i + 1,
			state: shownHere.has(seatId) ? 'drawn' : cardOpen && cardSeat === seatId ? 'held' : 'in-bag',
			seatId
		}))
	);
	function confirmShow() {
		host.showRoles(gameId, true);
		if (!noPhone.length) return;
		shownHere = new Set();
		listOpen = true;
	}
	function showHere(seatId: SeatId) {
		cardSeat = seatId;
		cardOpen = true;
	}
	function gapsNow() {
		const phones = new Set(host.members.flatMap((m) => (m.seatId ? [m.seatId] : [])));
		return [
			...roleGaps(game.game, game.characters, phones).map(({ seatId, gaps }) => ({
				key: seatId,
				name: seatName(game.game, seatId),
				text: gaps.map((gap) => t(GAP_TEXT[gap])).join(' · ')
			})),
			...host.unseatedInGame.flatMap((m) =>
				m.name ? [{ key: m.memberId, name: m.name, text: t('room.noSeat') }] : []
			)
		];
	}
	function toggle() {
		if (shown) return host.showRoles(gameId, false);
		warning = gapsNow();
		const phones = new Set(host.members.flatMap((m) => (m.seatId ? [m.seatId] : [])));
		noPhone = game.game.seating.filter((seatId) => roles[seatId] && !phones.has(seatId));
		if (warning.length) warn = true;
		else host.showRoles(gameId, true);
	}
</script>

<!-- An icon button like the ✕ beside it, with its words (Trevor, 2026-10-31: "it should say
     show characters"); pressed while players can look, counting down. Both labels share one
     cell, so it keeps its width as it changes and nothing beside it moves. -->
<IconButton
	icon={shown ? 'hide' : 'showToPlayer'}
	label={shown ? t('room.roles.hideLeft', { time }) : t('room.roles.show')}
	outlined
	aria-pressed={shown}
	disabled={!host.code}
	data-testid="roles-show"
	data-shown={shown || undefined}
	onclick={toggle}
	><span class="labels"
		><span class:off={shown}>{t('room.roles.show')}</span><span
			class:off={!shown}
			data-testid="roles-time-left">{t('room.roles.hideTime', { time })}</span
		></span
	></IconButton
>

<ConfirmDialog bind:open={warn} title={t('room.roles.gapsTitle')} onConfirm={confirmShow}>
	<ul class="gaps" data-testid="roles-gaps">
		{#each warning as gap (gap.key)}
			<li data-testid="roles-gap"><PlayerBadge name={gap.name} /><span>{gap.text}</span></li>
		{/each}
	</ul>
</ConfirmDialog>

<!-- Their names on tiles, as the bag draw's (Trevor, 2026-11-01: "make it look like a token
     draw, but instead of symbols it has the people's names"): a tap holds out that player's
     card, and their tile is drawn once it closes. -->
<Dialog bind:open={listOpen} title={t('room.roles.noPhoneTitle')}>
	<div data-testid="roles-no-phone">
		<BagTiles
			slots={noPhoneSlots}
			marks={noPhone.map((seatId) => ({ kind: 'player', name: seatName(game.game, seatId) }))}
			seatLabel={(seatId) => (seatId ? seatName(game.game, seatId) : '')}
			onpick={(slot) => slot.seatId && showHere(slot.seatId)}
		/>
	</div>
</Dialog>

<RoleCard
	bind:open={
		() => cardOpen,
		(open) => {
			cardOpen = open;
			if (!open && cardSeat) shownHere = new Set([...shownHere, cardSeat]);
		}
	}
	role={cardSeat ? roles[cardSeat] : undefined}
	characters={scriptCharacters}
	name={cardSeat ? seatName(game.game, cardSeat) : undefined}
/>

<style>
	.labels {
		display: inline-grid;
	}
	.labels > span {
		grid-area: 1 / 1;
		font-variant-numeric: tabular-nums;
	}
	.off {
		visibility: hidden;
	}
	.gaps {
		display: grid;
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.gaps li {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.gaps li:last-child {
		border-bottom: none;
	}
	.gaps span {
		flex: none;
		color: var(--on-surface-muted);
	}
</style>
