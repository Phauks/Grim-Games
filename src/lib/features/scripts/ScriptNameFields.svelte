<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * A script's name, author and version, as typed in the Script builder and fixed in a photo's
	 * review (Trevor, 2026-11-10: "allow editing script name and other relevant info").
	 */
	interface Props {
		name: string;
		author: string;
		version: string;
		disabled?: boolean;
		onName: (value: string) => void;
		onAuthor: (value: string) => void;
		onVersion: (value: string) => void;
	}

	let { name, author, version, disabled = false, onName, onAuthor, onVersion }: Props = $props();
</script>

<TextField label={t('script-builder.name')} value={name} {disabled} oninput={onName} />
<div class="byline">
	<TextField label={t('script-builder.author')} value={author} {disabled} oninput={onAuthor} />
	<TextField label={t('script-builder.version')} value={version} {disabled} oninput={onVersion} />
</div>

<style>
	/* Author and version share a row; the version is short. */
	.byline {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 7rem);
		gap: var(--space-2);
	}
</style>
