<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { recentDeaths, recentRevivals } from '#lib/core/engine/index.ts';
	import type { DeathCause, SeatId } from '#lib/core/model/index.ts';
	import { afterDawn, dayNumber, preventedDeaths, type Night } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { gameModeOf } from '#lib/features/modes/game-mode.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import type { DayPort } from './day-port.ts';
	import PreventedSheet from './PreventedSheet.svelte';

	/** The day's Announcements section: who died or came back, and what to read out (moved from DayPanel). */
	interface Props {
		game: DayPort;
	}

	let { game }: Props = $props();
	const g = $derived(game.game);

	/** Everyone who died since the previous day ended, to announce (Trevor, 2026-10-16). */
	const died = $derived(recentDeaths(game.log, g));
	/** And everyone brought back to life in that night (Trevor, 2026-10-20: L9). */
	const revived = $derived(recentRevivals(game.log, g));

	/**
	 * Announcing a death (Trevor, 2026-10-19: "show the exact statement"): what to say, in
	 * normal text, by seat and name and never by character; then for the Storyteller only,
	 * in italics, the character and the cause.
	 */
	function spokenDeath(seatId: SeatId): string {
		const seat = g.seating.indexOf(seatId) + 1;
		const name = g.seats[seatId].playerName;
		return name ? t('day.announce.died', { name, seat }) : t('day.announce.diedUnnamed', { seat });
	}
	function spokenRevival(seatId: SeatId): string {
		const seat = g.seating.indexOf(seatId) + 1;
		const name = g.seats[seatId].playerName;
		return name
			? t('day.announce.revived', { name, seat })
			: t('day.announce.revivedUnnamed', { seat });
	}
	function privateDeath(cause: DeathCause | undefined): string {
		const how =
			cause === undefined
				? t('day.announce.noCause')
				: cause === 'execution'
					? t('day.announce.executed')
					: cause === 'exile'
						? t('day.announce.exiled')
						: cause === 'demon'
							? t('day.announce.demon')
							: cause === 'other'
								? t('day.announce.other')
								: t('day.announce.killedBy', { killer: slot('cause') });
		return t('day.announce.private', { character: slot('character'), how });
	}
	/**
	 * A custom character is in play (Trevor, 2026-10-20: L28): the app doesn't know what it
	 * announces, so Announcements says it may be missing some.
	 */
	const customInPlay = $derived(
		g.seating.some((s) => {
			const id = g.seats[s].characterId;
			return g.script.entries.some((e) => e.kind === 'custom' && e.character.id === id);
		})
	);
	/** A dawn has come (End night), so "Nobody died in the night" means something. */
	const dawned = $derived(
		game.log.entries
			.slice(0, game.log.cursor)
			.some((e) => e.events.some((ev) => ev.type === 'DayStarted'))
	);
	/**
	 * With "I See Dead People" on, deaths are never announced (World Cup thread, 2026-10-19):
	 * the spoken line says so instead.
	 */
	const privateDeaths = $derived(gameModeOf(g.gameId)?.parts.deaths?.kind === 'private');

	// ── What didn't happen: a kill whose Dead token sits on a living player (Trevor) ──
	const prevented = $derived(preventedDeaths(g, game.characters));
	let preventedOpen = $state(false);

	/**
	 * Announcements as the day begins (Trevor, 2026-10-16): TPI's steps after Dawn for the
	 * night that just ended (the Vizier, the Leviathan), for characters in play, with TPI's
	 * night text. A new day starts when the night ends, so Day 1 follows the first night.
	 */
	const announcers = $derived.by(() => {
		const day = dayNumber(g);
		const sheet = officialData.current?.nightSheet;
		if (day === 0 || !sheet) return [];
		const night: Night = day === 1 ? 'first' : 'other';
		return afterDawn(sheet, night).flatMap((characterId) => {
			const character = game.characters.get(characterId);
			const text =
				night === 'first' ? character?.firstNightReminder : character?.otherNightReminder;
			const seatId = g.seating.find((s) => g.seats[s].characterId === characterId);
			return character && text && seatId ? [{ character, text, seatId, night }] : [];
		});
	});
</script>

<Collapsible
	title={t('day.announcements')}
	storageKey="day.announcements"
	count={died.length + revived.length + announcers.length}
>
	{#snippet aside()}
		<Button
			variant="quiet"
			icon="protected"
			data-testid="prevented-button"
			disabled={prevented.length === 0}
			aria-label={t('day.preventedButton', { count: prevented.length })}
			title={t('day.preventedButton', { count: prevented.length })}
			onclick={() => (preventedOpen = true)}>{prevented.length}</Button
		>
	{/snippet}
	{#if customInPlay}
		<p class="custom-note" data-testid="custom-announcements">{t('day.announce.custom')}</p>
	{/if}
	<ul class="reminders" data-testid="announcements">
		{#each died as death (death.seatId)}
			{@const seat = g.seats[death.seatId]}
			<li class="death" data-seat={death.seatId}>
				{#if privateDeaths}
					<span class="dont-announce" data-testid="dont-announce">{t('day.announce.dont')}</span>
				{:else}
					<span class="spoken" data-testid="spoken">{spokenDeath(death.seatId)}</span>
				{/if}
				<em class="private" data-testid="storyteller-only"
					><Sentence text={privateDeath(death.cause)}
						>{#snippet fill(name)}{#if name === 'character'}{#if seat.characterId}<CharacterBadge
										characterId={seat.characterId}
										alignment={seat.alignment}
									/>{:else}{t('day.announce.noCharacter')}{/if}{:else}{@render badge(
									death.cause
								)}{/if}{/snippet}</Sentence
					></em
				>
			</li>
		{/each}
		{#each revived as seatId (seatId)}
			{@const seat = g.seats[seatId]}
			<li class="death" data-seat={seatId} data-testid="revived">
				{#if privateDeaths}
					<span class="dont-announce">{t('day.announce.dont')}</span>
				{:else}
					<span class="spoken">{spokenRevival(seatId)}</span>
				{/if}
				<em class="private"
					><Sentence
						text={t('day.announce.private', {
							character: slot('character'),
							how: t('day.announce.backToLife')
						})}
						>{#snippet fill()}{#if seat.characterId}<CharacterBadge
									characterId={seat.characterId}
									alignment={seat.alignment}
								/>{:else}{t('day.announce.noCharacter')}{/if}{/snippet}</Sentence
					></em
				>
			</li>
		{/each}
		{#if died.length === 0 && dawned}
			<li class="death"><span class="spoken">{t('day.announce.nobody')}</span></li>
		{/if}
		{#each announcers as a (a.character.id)}
			<li data-character={a.character.id}>
				<CharacterEntry
					characterId={a.character.id}
					alignment={g.seats[a.seatId].alignment}
					playerName={game.seatName(a.seatId)}
				>
					<span class="sentence"
						><NightText text={a.text} character={a.character} night={a.night} /></span
					>
				</CharacterEntry>
			</li>
		{/each}
		{#if died.length === 0 && !dawned && revived.length === 0 && announcers.length === 0}
			<li>{t('common.none')}</li>
		{/if}
	</ul>
</Collapsible>

<PreventedSheet bind:open={preventedOpen} {game} {prevented} />

<!-- A character as a badge; false inside a button, so it does not open the character. -->
{#snippet badge(id: CharacterId | undefined, interactive = true)}{#if id}<CharacterBadge
			characterId={id}
			character={game.characters.get(id)}
			{interactive}
		/>{/if}{/snippet}

<style>
	.reminders {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sentence {
		font-family: var(--font-ability);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	/* The words to say, then the Storyteller's own detail under them in italics. */
	.death {
		display: grid;
		gap: var(--space-1);
	}
	.private {
		color: var(--on-surface-muted);
	}
	/* Only the words are italic; a character's name stays upright (Trevor, 2026-10-19). */
	.private :global(.badge) {
		font-style: normal;
	}
	.custom-note {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
	.dont-announce {
		justify-self: start;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		font-variant: small-caps;
	}
</style>
