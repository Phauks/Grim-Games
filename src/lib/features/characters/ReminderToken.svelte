<script lang="ts">
	import {
		characterIcons,
		ICONS_PATH,
		type CharacterId,
		type CharacterType
	} from '#lib/core/data/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { officialData } from './game-data.svelte.ts';

	interface Props {
		/** The token's text; leave out for "a reminder" when it is not known which. */
		label?: string;
		/** Type of the character the token belongs to: it sets the colour. */
		type?: CharacterType;
		/** The character the token belongs to: its icon goes in the disc. */
		characterId?: CharacterId;
		/** Shown on hover/long-press, e.g. the possible tokens. */
		title?: string;
		/**
		 * `reminder`: one of a character's reminder tokens (round, outlined in its type colour);
		 * `dead`: the death marker; `info`: the Storyteller's info tokens ("You are"), which
		 * belong to no character (neutral, square-cornered).
		 */
		variant?: 'reminder' | 'dead' | 'info';
		/** Whether the token goes on (`place`) or comes off (`remove`) at this point. */
		action?: 'place' | 'remove';
		/**
		 * A token pre-game prep places: `done` when it is in the grimoire, `todo` when not,
		 * `prep` when there is no game to check (reference pages).
		 */
		prep?: 'done' | 'todo' | 'prep';
	}

	let { label, type, characterId, title, variant = 'reminder', action, prep }: Props = $props();

	const icon = $derived.by(() => {
		if (variant !== 'reminder' || !characterId) return undefined;
		const character = officialData.current?.byId.get(characterId);
		const icons = character && characterIcons(character);
		const file = icons && (icons.unaligned ?? icons.good ?? icons.evil);
		return file ? `${ICONS_PATH}/${file}` : undefined;
	});
	const text = $derived(label ?? (variant === 'dead' ? 'Dead' : 'reminder'));
	const prepTitle = $derived(
		prep === 'done'
			? 'Placed during prep'
			: prep === 'todo'
				? 'Not placed yet: prep was skipped'
				: prep === 'prep'
					? 'Placed during pre-game prep'
					: undefined
	);
	const fullTitle = $derived(
		[title, action === 'remove' ? 'Remove this token' : undefined, prepTitle]
			.filter(Boolean)
			.join('. ') || undefined
	);
</script>

<!-- A reminder token as a small round chip: a disc with its character's icon, then its text. -->
<span
	class="reminder"
	data-type={variant === 'info' ? undefined : type}
	data-variant={variant}
	data-action={action}
	data-prep={prep}
	data-testid="reminder-token"
	title={fullTitle}
	>{#if variant !== 'info'}<span class="disc" aria-hidden="true"
			>{#if variant === 'dead'}<Icon name="dead" />{:else if icon}<img
					src={icon}
					alt=""
					width="16"
					height="16"
				/>{:else}<Icon name="reminder" />{/if}</span
		>{/if}<span class="label">{text}</span>{#if action === 'remove'}<span class="visually-hidden">
			(remove)</span
		>{/if}{#if prep}<span class="prep" aria-hidden="true"
			>{#if prep !== 'todo'}<Icon name="check" />{/if}</span
		><span class="visually-hidden"> ({prepTitle})</span>{/if}</span
>

<style>
	.reminder {
		--chip-colour: var(--reminder-face);
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.05em 0.55em 0.05em 0.1em;
		border: 1.5px solid var(--chip-colour);
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--chip-colour) 22%, var(--surface-raised));
		color: var(--on-surface);
		font-size: 0.82em;
		line-height: 1.35;
		white-space: nowrap;
		vertical-align: baseline;
		--icon-size: 0.95em;
	}
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		--chip-colour: var(--good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		--chip-colour: var(--evil);
	}
	.reminder[data-type='traveller'] {
		--chip-colour: var(--traveller);
	}
	.reminder[data-type='fabled'] {
		--chip-colour: var(--fabled);
	}
	.reminder[data-type='loric'] {
		--chip-colour: var(--loric);
	}
	.disc {
		display: inline-grid;
		place-items: center;
		width: 1.3em;
		height: 1.3em;
		flex: none;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		overflow: hidden;
	}
	.disc img {
		width: 1.1em;
		height: 1.1em;
	}
	.reminder[data-action='remove'] .label {
		text-decoration: line-through;
		text-decoration-thickness: 1.5px;
	}
	.reminder[data-action='remove'] {
		border-style: dashed;
	}
	/* Fixed-width slot: checking a prep token never changes the chip's size. */
	.prep {
		display: inline-grid;
		place-items: center;
		width: 1em;
		height: 1em;
		border: 1px solid currentColor;
		border-radius: 50%;
		--icon-size: 0.75em;
	}
	.reminder[data-prep='prep'] .prep {
		opacity: 0.6;
	}
	/* Info tokens belong to no character: neutral and square-cornered, no disc. */
	.reminder[data-variant='info'] {
		padding: 0.05em 0.5em;
		border: 1px solid var(--on-surface-muted);
		border-radius: var(--radius-sm, 0.25em);
		background: transparent;
		color: var(--on-surface);
		font-variant: small-caps;
		letter-spacing: 0.02em;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
