<script lang="ts">
	import type { CharacterType } from '#lib/core/data/index.ts';

	interface Props {
		/** The token's text; leave out for "a reminder" when it is not known which. */
		label?: string;
		/** Type of the character the token belongs to: it sets the colour. */
		type?: CharacterType;
		/** Shown on hover/long-press, e.g. the possible tokens. */
		title?: string;
		/** `info` for the Storyteller's info tokens ("You are"), which belong to no character. */
		variant?: 'reminder' | 'info';
	}

	let { label, type, title, variant = 'reminder' }: Props = $props();
</script>

<!-- A reminder token as a small chip, coloured by its character's type. -->
<span
	class="reminder"
	data-type={variant === 'info' ? undefined : type}
	data-variant={variant}
	data-testid="reminder-token"
	{title}>{label ?? 'reminder'}</span
>

<style>
	.reminder {
		display: inline-block;
		padding: 0.05em 0.6em;
		border-radius: var(--radius-full);
		background: var(--reminder-face);
		color: var(--on-reminder);
		font-size: 0.85em;
		line-height: 1.4;
		white-space: nowrap;
		vertical-align: baseline;
	}
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		background: var(--good);
		color: var(--on-good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.reminder[data-type='traveller'] {
		background: var(--traveller);
		color: var(--on-traveller);
	}
	.reminder[data-type='fabled'] {
		background: var(--fabled);
		color: var(--on-fabled);
	}
	.reminder[data-type='loric'] {
		background: var(--loric);
		color: var(--on-loric);
	}
	.reminder[data-variant='info'] {
		background: var(--token-face);
		color: var(--on-token);
		font-variant: small-caps;
	}
</style>
