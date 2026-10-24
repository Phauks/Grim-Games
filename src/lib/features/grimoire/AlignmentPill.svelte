<script lang="ts">
	import type { Alignment } from '#lib/core/data/index.ts';

	/** An alignment in its own colour: Good, Evil, or Not set. */
	interface Props {
		alignment: Alignment | undefined;
		/** Words in place of the alignment's name, such as "Good wins". */
		text?: string;
	}

	let { alignment, text }: Props = $props();
</script>

<strong class="team" data-team={alignment ?? 'neutral'}
	>{text ?? (alignment === 'good' ? 'Good' : alignment === 'evil' ? 'Evil' : 'Not set')}</strong
>

<style>
	.team {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.team[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.team[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
</style>
