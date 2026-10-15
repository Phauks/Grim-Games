<script lang="ts">
	import { onMount } from 'svelte';
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Alignment,
		type CharacterId
	} from '#lib/core/data/index.ts';
	import CharacterDialog from './CharacterDialog.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';

	interface Props {
		characterId: CharacterId;
		/** The seat's alignment; defaults from the character's type. */
		alignment?: Alignment;
		/** Shown after the role when the seat has a player name. */
		playerName?: string;
	}

	let { characterId, alignment, playerName }: Props = $props();
	let open = $state(false);

	onMount(() => void loadOfficialData());

	const character = $derived(officialData.current?.byId.get(characterId));
	const team = $derived(
		alignment ?? (character ? (defaultAlignment(character.type) ?? 'neutral') : 'neutral')
	);
	const icon = $derived.by(() => {
		const icons = character && characterIcons(character);
		if (!icons) return undefined;
		const file =
			(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
			icons.unaligned ??
			icons.good;
		return file && `${ICONS_PATH}/${file}`;
	});
	const label = $derived(character?.name ?? characterId);
</script>

<button
	type="button"
	class="badge"
	data-team={team}
	aria-haspopup="dialog"
	onclick={() => (open = true)}
>
	<!-- Fixed-size icon slot so the badge never changes size when data or icons arrive. -->
	<span class="icon"
		>{#if icon}<img src={icon} alt="" width="28" height="28" />{/if}</span
	>
	<span class="name">{label}</span>
	{#if playerName}<span class="player">· {playerName}</span>{/if}
</button>

{#if character}
	<CharacterDialog bind:open {character} {icon} />
{/if}

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1, calc(0.25 * var(--u)));
		min-height: var(--tap-target);
		padding: 0 var(--space-3, calc(0.75 * var(--u))) 0 var(--space-1, calc(0.25 * var(--u)));
		border: 0;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		vertical-align: middle;
		cursor: pointer;
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.badge[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.badge[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.icon {
		display: inline-grid;
		place-items: center;
		width: calc(2 * var(--u));
		height: calc(2 * var(--u));
		flex: none;
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
		overflow: hidden;
	}
	.icon img {
		width: calc(1.75 * var(--u));
		height: calc(1.75 * var(--u));
	}
	.name {
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
	}
	.player {
		font-family: var(--font-player);
		font-weight: 400;
		opacity: 0.9;
	}
</style>
