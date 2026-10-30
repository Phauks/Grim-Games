<script lang="ts">
	import { onMount } from 'svelte';
	import { TOKEN_SCALE, type TokenAppearance } from '#lib/ui/token/token-appearance.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from './CharacterBadge.svelte';
	import ReminderToken from './ReminderToken.svelte';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { sheetNumbersFor } from './sheet-night-numbers.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import { boardTokenSize } from '#lib/ui/seating/last-board.svelte.ts';
	import { reminderTokenSize } from '#lib/ui/seating/seat-layout.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	/**
	 * The live preview for one box of token settings: the character token, the reminder token,
	 * or names and reminders in text. Settings > Tokens and the player's Text and token sizes
	 * (Trevor, 2026-10-27: "should have a preview area ... use the common components") show it
	 * in a `SettingGroup`.
	 */
	interface Props {
		kind: 'token' | 'reminder' | 'inText';
		value: TokenAppearance;
	}

	let { kind, value }: Props = $props();

	onMount(() => void loadOfficialData());
	// A character with every marking, so each leaf setting shows (Trevor, 2026-10-19: "a setup,
	// reminder token, and operate in both types of nights"): the Godfather. "Died Today" is
	// also long enough to show the reminder word settings.
	const SAMPLE_ID = 'godfather';
	const sample = $derived(officialData.current?.byId.get(SAMPLE_ID));
	// Long words, so Reminder words width and Wrap long reminder words show (Trevor,
	// 2026-10-22: every setting shows in its preview).
	const REMINDER_SAMPLE_ID = 'devilsadvocate';
	const reminderSample = $derived(officialData.current?.byId.get(REMINDER_SAMPLE_ID));
	// The sample as the only character in play (Trevor, 2026-10-17: "a low number (1) (1),
	// not absolute"): 1 on each night it wakes.
	const sampleNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || value.nightLeaves !== 'numbers') return undefined;
		const { first, other } = sheetNumbersFor(data.nightSheet, SAMPLE_ID);
		return { first: first && 1, other: other && 1 };
	});
	// The token at the size the board draws it (Trevor, 2026-10-17: the preview didn't match
	// the size in play): the last board's size, or a ten-player board filling the window.
	const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });
	const tokenSize = $derived(boardTokenSize(value.tokenScale, viewport));
	// Room for the largest Token size, so moving the slider never moves the settings below.
	const largest = $derived(boardTokenSize(TOKEN_SCALE.max, viewport));
	// The reminder as the board draws it, at the board's size for this token (GrimoireBoard:
	// half the token, kept between 30 and 48px, times Reminder size). Trevor, 2026-10-17: the
	// preview showed the inline chip, not the reminder token.
	const reminderSize = $derived(reminderTokenSize(tokenSize, value.reminderScale));

	const largestReminder = $derived(reminderTokenSize(largest, TOKEN_SCALE.max));
</script>

{#if kind === 'token'}
	<div class="preview token-sample" style:--sample="{largest}px">
		{#if sample}<span
				class="disc"
				style:--name-scale={boardLooks.current.nameSize}
				style:--name-offset={boardLooks.current.nameOffset}
				><CharacterToken
					character={sample}
					size={tokenSize}
					showName={value.boardNames}
					nightNumbers={sampleNumbers}
				/><PlayerNameMark name={t('characters.previewPlayer')} /></span
			>{/if}
	</div>
{:else if kind === 'reminder'}
	<!-- As it rests, then highlighted as a held seat's reminder (Trevor, 2026-10-20). Its
	     player has turned good, so its owner's icon is good's (Trevor, 2026-10-23). Then an ∞
	     token with an icon symbol. -->
	<div class="preview reminder-sample" style:--sample="{largestReminder}px">
		{#if reminderSample}<BoardReminder
				label={reminderSample.reminders[0]}
				character={reminderSample}
				alignment="good"
				size={reminderSize}
				disabled
				onTap={() => {}}
			/><span class="lit" data-testid="lit-reminder-sample"
				><BoardReminder
					label={reminderSample.reminders[0]}
					character={reminderSample}
					alignment="good"
					size={reminderSize}
					disabled
					onTap={() => {}}
				/></span
			><BoardReminder
				label={'' as ReminderLabel}
				character={undefined}
				infinite
				symbol="ph:star"
				size={reminderSize}
				disabled
				onTap={() => {}}
			/>{/if}
	</div>
{:else}
	<!-- A line of text with a name and a reminder. The badge is the one design used
	     everywhere, in lists too (Trevor, 2026-10-20). -->
	<div class="preview in-text">
		<p class="line">
			{#if sample}<CharacterBadge characterId={sample.id} character={sample} interactive={false} />
				{t('characters.inTextPlaces')}
				<ReminderToken
					label={sample.reminders[0] ?? t('characters.previewReminder')}
					character={sample}
				/>
				{t('characters.inTextOn', { player: t('characters.previewPlayer') })}{/if}
		</p>
	</div>
{/if}

<style>
	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		/* A fixed height that fits the largest token (--sample, set above) with the player name
		   badge on its rim, and the largest chip at any Text size, so changing a size never moves
		   the settings below. */
		height: max(calc(1.1 * var(--sample)), 4.4rem);
		white-space: nowrap;
		overflow: hidden;
	}
	/* Room under the largest token for the player name at its largest size and distance
	   (Trevor, 2026-10-20), so neither slider moves the settings or hides the name. */
	.token-sample {
		align-items: flex-start;
		height: max(calc(1.45 * var(--sample)), 4.4rem);
	}
	.reminder-sample {
		height: max(var(--sample), 3rem);
	}
	/* Wide, the box beside the settings is too narrow for the reminders side by side at their
	   largest, so they stack: at rest, highlighted, then the ∞ token. */
	@container (min-width: 26rem) {
		.reminder-sample {
			flex-direction: column;
			height: max(calc(3 * var(--sample) + 2 * var(--space-4)), 9rem);
		}
	}
	/* The board's highlight on a held seat's reminders (GrimoireBoard .chip-slot.lit). */
	.lit {
		display: contents;
	}
	.lit > :global(.reminder) {
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
	}
	/*
	 * Narrow, the box sits above its settings, so it keeps room for every size at its largest
	 * (no reflow), measured at phone width. Wide, it sits beside them, so it fits what it shows
	 * (Trevor, 2026-10-19: the box was far bigger than its sample).
	 */
	.in-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: var(--space-2);
		height: 8.5rem;
		white-space: normal;
	}
	@container (min-width: 26rem) {
		.in-text {
			height: auto;
		}
	}
	.in-text .line {
		margin: 0;
		line-height: 2.2;
	}
	.disc {
		/* Drawn at the board's size, which already includes Token size (as SeatToken). */
		position: relative;
		display: inline-block;
		line-height: 0;
	}
</style>
