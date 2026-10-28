<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder } from '#lib/core/model/index.ts';
	import { seatRoles } from '#lib/core/sync/seat-roles.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * Players' own characters on their phones (Trevor, 2026-10-26: "Storyteller sees who has
	 * seen their role. Then can turn on and off when ppl can see it"). Every seat is listed,
	 * phone or not (Trevor: some players use a physical token), so the Storyteller sees who
	 * still needs theirs shown another way.
	 */
	let { game }: { game: OpenGame } = $props();

	const host = roomHost();
	const gameId = $derived(game.game.gameId);
	const shown = $derived(host.rolesShown.gameId === gameId);
	const roles = $derived(seatRoles(game.game, game.characters));
	const seats = $derived(seatsInOrder(game.game));
	const phones = $derived(new Set(host.members.flatMap((m) => (m.seatId ? [m.seatId] : []))));
	const seen = $derived(new Set(host.rolesSeen));

	function stateOf(seatId: string, characterId: string | undefined): string {
		if (!characterId) return t('room.roles.noCharacter');
		if (!roles[seatId])
			return game.characters.get(characterId)?.type === 'traveller'
				? t('room.roles.noAlignment')
				: t('room.roles.withheld');
		if (!phones.has(seatId)) return t('room.roles.noPhone');
		if (seen.has(seatId)) return t('room.roles.seen');
		return shown ? t('room.roles.notSeen') : t('room.roles.hidden');
	}
</script>

<section class="roles" aria-labelledby="roles-label" data-testid="roles-panel">
	<h2 id="roles-label">{t('room.roles.heading')}</h2>
	<SettingToggle
		label={t('room.roles.toggle')}
		description={t('room.roles.hint')}
		checked={shown}
		disabled={!host.code}
		onChange={(on) => host.showRoles(gameId, on)}
	/>
	<h3 id="roles-seats">{t('room.roles.seats')}</h3>
	<ul class="seats" aria-labelledby="roles-seats">
		{#each seats as seat, i (seat.seatId)}
			{@const state = stateOf(seat.seatId, seat.characterId)}
			<li data-testid="role-seat" data-seen={seen.has(seat.seatId) ? '' : undefined}>
				<span class="who"
					>{#if seat.playerName}<PlayerBadge name={seat.playerName} />{:else}{t('common.seat', {
							number: i + 1
						})}{/if}</span
				>
				<span class="state" class:done={seen.has(seat.seatId)}>{state}</span>
			</li>
		{/each}
	</ul>
</section>

<style>
	.roles {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-size: 1rem;
	}
	.seats {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not bordered cards (Trevor). */
	.seats li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border);
	}
	.who {
		min-width: 0;
	}
	.state {
		flex: none;
		color: var(--on-surface-muted);
	}
	.state.done {
		color: var(--good-text);
	}
</style>
