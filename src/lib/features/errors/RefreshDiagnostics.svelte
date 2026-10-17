<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { refreshDiagnostics } from './diagnostics-view.svelte.ts';
</script>

<IconButton icon="refresh" label={t('errors.diag.refresh')} onclick={refreshDiagnostics} />
