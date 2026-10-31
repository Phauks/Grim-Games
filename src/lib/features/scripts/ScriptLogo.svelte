<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * A script's logo, the same wherever a script is shown (Trevor, 2026-10-18). Beside a name,
	 * use ScriptName; on its own, BoardLogo (the board's middle), CoverScreen, ScriptQrCenter
	 * and the printed sheet draw it (`grim/script-name`). `src` comes from `scriptLogo` (TPI's
	 * edition logo, or the author's `_meta.logo` link, loaded from there and never copied).
	 * The box keeps its size whether or not the image arrives, so nothing moves around it;
	 * without `src`, or if the link fails, the box stays empty.
	 */
	interface Props {
		src: string | undefined;
		/** The script's name, for "<name> logo"; '' for a logo beside the name, which is decorative. */
		name?: string;
		/** Sizes the box; the logo fits inside it, keeping its shape. */
		class?: string;
		/** Told when the link fails, e.g. to show the name instead. */
		onfail?: () => void;
	}

	let { src, name = '', class: className = '', onfail }: Props = $props();

	let failed = $state(false);
	$effect(() => {
		void src;
		failed = false;
	});
</script>

<span
	class="script-logo {className}"
	data-testid="script-logo"
	data-logo={src && !failed ? src : undefined}
>
	{#if src && !failed}
		<!-- No referrer: an author's image host learns nothing about which page asked. -->
		<img
			{src}
			alt={name ? t('scripts.logoAlt', { name }) : ''}
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			draggable="false"
			onerror={() => {
				failed = true;
				onfail?.();
			}}
		/>
	{/if}
</span>

<style>
	/* The image is laid over the box, so its size is always the box's and never the picture's
	   own (about 500px for TPI's logos), whatever a browser makes of percentage heights. */
	.script-logo {
		position: relative;
		display: inline-block;
		flex: none;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		user-select: none;
	}
</style>
