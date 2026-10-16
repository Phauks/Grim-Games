<script lang="ts">
	import type { Alignment, CharacterType } from '#lib/core/data/index.ts';

	interface Props {
		/** The token's text; leave out for "a reminder" when it is not known which. */
		label?: string;
		/** Type of the character the token belongs to: it sets the colour. */
		type?: CharacterType;
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
	}

	let { label, type, alignment, title, variant = 'reminder', done = false }: Props = $props();
</script>

<!-- A reminder token as a small chip, coloured by its character's type. -->
<span
	class="reminder"
	data-type={variant === 'info' ? undefined : type}
	data-alignment={variant === 'info' ? undefined : alignment}
	data-variant={variant}
	data-testid="reminder-token"
	data-done={done || undefined}
	{title}
	>{label ?? 'reminder'}{#if done}<span class="tick" aria-label="already placed">✓</span>{/if}</span
>

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
		/* The user's Reminder size (--reminder-scale, Settings) scales it. */
		font-size: calc(max(0.85em, 0.8rem) * var(--reminder-scale, 1));
		font-weight: 600;
		line-height: 1.4;
		/* One line, unless the chip alone is wider than its line (tiny screen, largest text). */
		max-width: 100%;
		vertical-align: baseline;
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
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		--rim: var(--good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		--rim: var(--evil);
	}
	.reminder[data-type='traveller'] {
		--rim: var(--traveller);
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
	.tick {
		margin-left: 0.15em;
		font-variant: normal;
	}
</style>
