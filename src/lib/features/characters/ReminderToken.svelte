<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character, CharacterType, ReminderLabel } from '#lib/core/data/index.ts';
	import { iconUrl } from './icon-url.ts';

	interface Props {
		/** The token's text; leave out for "a reminder" when it is not known which. */
		label?: ReminderLabel;
		/** Type of the character the token belongs to: it sets the colour. */
		type?: CharacterType;
		/**
		 * The character the token belongs to: its icon replaces the coloured dot, so a token
		 * says whose it is at a glance (Trevor, 2026-10-17). Sets the type too.
		 */
		character?: Character;
		/**
		 * Alignment of the player whose character put the token down, when known: it sets the
		 * colour instead of the type (Trevor, 2026-10-16), so a turned-evil good player's
		 * reminders are red.
		 */
		alignment?: Alignment;
		/** Shown on hover/long-press, e.g. the possible tokens. */
		title?: string;
		/** `info` for the Storyteller's info tokens ("You are"), which belong to no character. */
		variant?: 'reminder' | 'info';
		/** Already placed (during pre-game prep): drawn ticked, in place. */
		done?: boolean;
		/** How many of this token the character has, shown as ×count when more than one. */
		count?: number;
	}

	let {
		label,
		type: given,
		character,
		alignment,
		title,
		variant = 'reminder',
		done = false,
		count = 1
	}: Props = $props();

	const type = $derived(given ?? character?.type);
	const icon = $derived(
		variant === 'reminder' && character ? iconUrl(character, alignment) : undefined
	);
</script>

<!-- A reminder token as a small chip, coloured by its character's type. -->
<!-- eslint-disable grim/names-as-badges -- this is the chip -->
<span
	class="reminder"
	data-type={variant === 'info' ? undefined : type}
	data-alignment={variant === 'info' ? undefined : alignment}
	data-variant={variant}
	data-testid="reminder-token"
	data-done={done || undefined}
	data-icon={icon ? '' : undefined}
	title={title ?? character?.name}
	>{#if icon}<img class="owner" src={icon} alt="" />{/if}{label ??
		t('characters.reminder')}{#if count > 1}<span class="count">×{count}</span>{/if}{#if done}<span
			class="tick"
			aria-label={t('characters.reminderPlaced')}>✓</span
		>{/if}</span
>

<!-- eslint-enable grim/names-as-badges -->

<style>
	/*
	 * A reminder is drawn as a small parchment token with a rim in its character's type
	 * colour, so it never looks like a character badge (a filled pill with an icon).
	 */
	.reminder {
		--rim: var(--token-face-shade);
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0 0.45em 0 0.2em;
		border-radius: 0.35em;
		background: var(--reminder-face);
		box-shadow: inset 0 0 0 1.5px var(--rim);
		color: var(--on-reminder);
		/*
		 * Easy to read (Trevor, 2026-10-16): the Reminder tokens font role (plain by default) in normal case and bold, not
		 * the display font in small capitals. Never smaller than 0.8rem, which follows Text size.
		 */
		font-family: var(--font-reminder);
		/* The user's Reminder size in text (--inline-reminder-scale, Settings) scales it. */
		font-size: calc(max(0.85em, 0.8rem) * var(--inline-reminder-scale, 1));
		font-weight: 600;
		line-height: 1.4;
		/* One line, unless the chip alone is wider than its line (tiny screen, largest text). */
		max-width: 100%;
		/*
		 * Its middle level with the text's middle (Trevor, 2026-10-18). On the baseline, a chip
		 * with its owner's icon sat high: an inline-flex box takes its baseline from its first
		 * item, and an image's baseline is its bottom edge.
		 */
		vertical-align: middle;
	}
	/* The little round token mark. */
	.reminder::before {
		content: '';
		flex: none;
		width: 0.75em;
		height: 0.75em;
		border-radius: 50%;
		background: var(--rim);
	}
	/* The owner's icon instead of the dot. */
	.reminder[data-icon] {
		padding-left: 0.1em;
	}
	/* Settings > Tokens can show the dot instead of the icon. */
	.reminder[data-icon]::before {
		display: var(--inline-reminder-dot, none);
	}
	.owner {
		display: var(--inline-reminder-owner, inline);
		flex: none;
		width: 1.5em;
		height: 1.5em;
		margin: -0.1em 0;
	}
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		--rim: var(--good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		--rim: var(--evil);
	}
	/*
	 * A Traveller's reminder, its player's alignment unknown: half good blue, half evil red,
	 * like a Traveller's token (Trevor, 2026-10-18). The face is laid over the split, inset
	 * by the rim's width, so the chip keeps its size.
	 */
	.reminder[data-type='traveller']:not([data-alignment]) {
		--rim: linear-gradient(to right, var(--good) 50%, var(--evil) 50%);
		--face-inset: 3px; /* px-ok: twice the 1.5px rim the other chips draw */
		box-shadow: none;
		background:
			linear-gradient(var(--reminder-face) 0 0) center / calc(100% - var(--face-inset))
				calc(100% - var(--face-inset)) no-repeat,
			var(--rim);
	}
	.reminder[data-type='fabled'] {
		--rim: var(--fabled);
	}
	.reminder[data-type='loric'] {
		--rim: var(--loric);
	}
	/* The player's alignment, when known, wins over the type's. */
	.reminder[data-alignment='good'] {
		--rim: var(--good);
	}
	.reminder[data-alignment='evil'] {
		--rim: var(--evil);
	}
	/* Info tokens belong to no character: no mark, dashed rim. */
	.reminder[data-variant='info'] {
		padding-left: 0.45em;
		box-shadow: none;
		outline: 1.5px dashed var(--on-token);
		outline-offset: -1.5px;
	}
	.reminder[data-variant='info']::before {
		display: none;
	}
	/* Already placed during prep: muted, with a tick. */
	.reminder[data-done] {
		opacity: 0.7;
	}
	.count {
		font-variant-numeric: tabular-nums;
	}
	.tick {
		margin-left: 0.15em;
		font-variant: normal;
	}
</style>
