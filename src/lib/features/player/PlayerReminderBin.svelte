<script lang="ts">
	import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import { GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { matchesReminderSearch } from '#lib/features/characters/character-search.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import ReminderBinSheet from '#lib/features/grimoire/ReminderBinSheet.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import {
		guessesFirst,
		reminderWords,
		scriptReminderGroups,
		type PlayerReminder
	} from './player-reminders.ts';

	/**
	 * A player's reminder bin (Trevor, 2026-10-29: the bin, not a list on the seat's sheet), the
	 * Storyteller's pulled-up bank's sheet (ReminderBinSheet), opened from the Grim tab's
	 * reminder button: the characters this player guessed first, then the rest of the script,
	 * then the generic ∞; a search narrows them. Drag a token onto a seat, or tap it and then
	 * a seat. A player's tokens never run out: the same one may go on several seats.
	 */
	interface Props {
		open: boolean;
		characters: readonly Character[];
		/** Characters the player guessed on any seat, or knows (a Traveller): first. */
		guessed: readonly CharacterId[];
		seats: readonly PublicSeat[];
		/** Each seat's centre, in % of the town. */
		points: readonly SeatPoint[];
		/** The town, for where a token is dropped. */
		town: HTMLElement | undefined;
		/** Token and reminder diameters in px. */
		size: number;
		chip: number;
		onPlace: (seat: PublicSeat, reminder: PlayerReminder) => void;
	}

	let {
		open = $bindable(),
		characters,
		guessed,
		seats,
		points,
		town,
		size,
		chip,
		onPlace
	}: Props = $props();

	interface Token {
		key: string;
		reminder: PlayerReminder;
		character?: Character;
	}
	const GENERIC: Token = {
		key: 'generic',
		reminder: { characterId: GENERIC_REMINDER_ID as CharacterId, label: '' as ReminderLabel }
	};

	let query = $state('');
	const groups = $derived.by(() => {
		const parts = guessesFirst(
			scriptReminderGroups(characters).filter((g) => matchesReminderSearch(g, query)),
			guessed
		);
		const tokens = (list: typeof parts.first) =>
			list.flatMap((g) =>
				g.labels.map((label) => ({
					key: `${g.character.id}:${label}`,
					reminder: { characterId: g.character.id, label },
					character: g.character
				}))
			);
		return [
			{ key: 'guesses', caption: t('player.grim.yourGuesses'), items: tokens(parts.first) },
			{ key: 'script', caption: t('player.grim.onTheScript'), items: tokens(parts.rest) },
			{ key: 'generic', caption: '∞', items: query.trim() ? [] : [GENERIC] }
		];
	});

	// ── Drag a token onto a seat ──
	let drag = $state<{ token: Token; at: SeatPoint }>();
	function seatAt(at: SeatPoint): PublicSeat | undefined {
		if (!town) return undefined;
		const { width, height } = town.getBoundingClientRect();
		let best: PublicSeat | undefined;
		let bestDistance = size * 0.75;
		points.forEach((p, i) => {
			const d = Math.hypot(((p.x - at.x) / 100) * width, ((p.y - at.y) / 100) * height);
			if (d < bestDistance) {
				best = seats[i];
				bestDistance = d;
			}
		});
		return best;
	}
	function dragToken(token: Token, x: number, y: number, end: boolean) {
		if (!town) return;
		const rect = town.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		if (!end) {
			drag = { token, at };
			return;
		}
		drag = undefined;
		const seat = seatAt(at);
		if (seat) onPlace(seat, token.reminder);
	}

	// ── Tap a token, then a seat ──
	let placing = $state<Token>();
	/** A seat tapped while placing gets the token; false when nothing is being placed. */
	export function placeOn(seat: PublicSeat): boolean {
		if (!placing) return false;
		onPlace(seat, placing.reminder);
		placing = undefined;
		return true;
	}
	$effect(() => {
		if (!open) placing = undefined;
	});
</script>

{#snippet token(token: Token, floating = false)}
	<BoardReminder
		label={token.character ? token.reminder.label : ('' as ReminderLabel)}
		character={token.character}
		infinite={!token.character}
		size={chip}
		disabled={floating}
		onTap={() => (placing = token)}
		onDrag={(x, y, end) => dragToken(token, x, y, end)}
		onCancel={() => (drag = undefined)}
	/>
{/snippet}

<ReminderBinSheet
	bind:open
	label={t('player.grim.reminderBin')}
	{groups}
	keyOf={(item) => item.key}
	item={token}
	lowered={!!drag || !!placing}
>
	{#snippet header()}<SearchField
			label={t('common.searchReminders')}
			bind:value={query}
		/>{/snippet}
</ReminderBinSheet>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		{@render token(drag.token, true)}
	</div>
{/if}

<!-- Tapped: which seat it goes on, over the town's foot. -->
{#if placing}
	<div class="placing" role="status" data-testid="bin-placing">
		<span>{t('player.grim.tapSeatFor', { label: reminderWords(placing.reminder) })}</span>
		<Button onclick={() => (placing = undefined)}>{t('common.cancel')}</Button>
	</div>
{/if}

<style>
	.floating {
		position: absolute;
		z-index: 4;
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
	.placing {
		position: absolute;
		left: 50%;
		bottom: var(--space-2);
		z-index: 4;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		box-shadow: var(--shadow);
		translate: -50% 0;
		white-space: nowrap;
	}
</style>
