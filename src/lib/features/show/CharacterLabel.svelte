<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Alignment,
		type Character
	} from '#lib/core/data/index.ts';

	interface Props {
		character: Character;
		alignment?: Alignment;
	}

	let { character, alignment }: Props = $props();

	const team = $derived(alignment ?? defaultAlignment(character.type) ?? 'neutral');
	const icon = $derived.by(() => {
		const icons = characterIcons(character);
		if (!icons) return typeof character.image === 'string' ? character.image : character.image?.[0];
		const file =
			(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
			icons.unaligned ??
			icons.good;
		return file && `${ICONS_PATH}/${file}`;
	});
</script>

<!--
	A character's badge look (icon on the left, coloured by team) without the badge's own tap
	action, for use inside rows that are themselves buttons.
-->
<span class="label" data-team={team}>
	<span class="icon"
		>{#if icon}<img src={icon} alt="" width="28" height="28" />{/if}</span
	>
	<span class="name">{character.name}</span>
</span>

<style>
	.label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		max-width: 100%;
		min-height: calc(2.25 * var(--u));
		padding: 0 var(--space-3) 0 var(--space-1);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.label[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.label[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: calc(2 * var(--u) * var(--character-icon-scale, 1));
		height: calc(2 * var(--u) * var(--character-icon-scale, 1));
		border-radius: var(--radius-full);
		background: var(--token-face, var(--on-surface));
	}
	img {
		width: calc(1.75 * var(--u) * var(--character-icon-scale, 1));
		height: calc(1.75 * var(--u) * var(--character-icon-scale, 1));
		object-fit: contain;
	}
	.name {
		overflow: hidden;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
