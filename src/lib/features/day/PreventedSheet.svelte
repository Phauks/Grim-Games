<script lang="ts">
	import SeatBadge from '#lib/features/grimoire/SeatBadge.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { PreventedBecause, PreventedDeath } from '#lib/core/rules/day/prevented-deaths.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import type { DayPort } from './day-port.ts';

	/** Kills that didn't happen and why, from the day's Announcements (moved from DayPanel). */
	interface Props {
		open?: boolean;
		game: DayPort;
		prevented: readonly PreventedDeath[];
	}

	let { open = $bindable(false), game, prevented }: Props = $props();
	const g = $derived(game.game);

	// ── What didn't happen: a kill whose Dead token sits on a living player (Trevor) ──

	/** The characters that explain a survival, with their seats, for their ability text. */
	function blockers(because: PreventedBecause): { characterId: CharacterId; seatId?: SeatId }[] {
		switch (because.kind) {
			case 'protected':
				return because.source === 'override' ? [] : [because.source];
			case 'killer-impaired':
				return because.impairments.map((i) => i.source);
			case 'survives-first-death':
			case 'may-bounce':
				return [because.source];
		}
	}
</script>

<BottomSheet bind:open title={t('day.prevented')}>
	<ul class="prevented" data-testid="prevented">
		{#each prevented as p (p.reminderId)}
			<li>
				<!-- Laid out like a jinx, as every row of the day (Trevor, 2026-10-18). -->
				<CharacterPiece
					template="entry"
					characterId={p.killer}
					alignment={p.killerSeats[0] ? g.seats[p.killerSeats[0]].alignment : undefined}
					playerName={p.killerSeats[0] ? game.seatName(p.killerSeats[0]) : undefined}
				>
					<span class="sentence">
						<span>{t('day.preventedChose')}</span>
						<SeatBadge game={game.game} seatId={p.seatId} />
					</span>
					<ul class="because">
						{#each p.because as because, i (i)}
							{#if because.kind === 'protected' && because.source === 'override'}
								<li>{t('day.preventedOverride')}</li>
							{/if}
							{#each blockers(because) as b (b.characterId)}
								<li data-character={b.characterId}>
									<!-- TPI's ability text, so the Storyteller sees what the reminder is about. -->
									<CharacterPiece
										template="entry"
										ability
										characterId={b.characterId}
										alignment={b.seatId ? g.seats[b.seatId].alignment : undefined}
										playerName={b.seatId ? game.seatName(b.seatId) : undefined}
									/>
								</li>
							{/each}
						{:else}
							<li>{t('day.preventedNoReason')}</li>
						{/each}
					</ul>
				</CharacterPiece>
			</li>
		{/each}
	</ul>
</BottomSheet>

<style>
	.sentence {
		font-family: var(--font-ability);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.prevented,
	.because {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.because {
		margin-block-start: var(--space-1);
	}
</style>
