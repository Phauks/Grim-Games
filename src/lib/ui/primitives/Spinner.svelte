<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The one sign that something is loading (Trevor, 2026-10-22: "show a progress notifier if
	 * we are loading something"): the loading icon turning. Sized by the surrounding text;
	 * pass `label` when nothing next to it says what is loading.
	 */
	interface Props {
		label?: string;
		testid?: string;
	}

	let { label, testid }: Props = $props();
</script>

<span
	class="spinner"
	role={label ? 'status' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-testid={testid}><Icon name="loading" /></span
>

<style>
	.spinner {
		display: inline-grid;
		place-items: center;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 3s;
		}
	}
</style>
