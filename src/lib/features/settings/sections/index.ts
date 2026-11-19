import { registerSettingsSection } from '../registry.ts';
import AssistanceSection from './AssistanceSection.svelte';
import ThemeSection from './ThemeSection.svelte';
import TextSection from './TextSection.svelte';
import { resets } from './resets.ts';
import IconsSection from './IconsSection.svelte';
import DataSection from './DataSection.svelte';
import LanguageSection from './LanguageSection.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';
import '#lib/features/sound/settings-section.ts';

// Built-in sections, grouped by topic in one list (Trevor, 2026-10-17: no audience groups;
// every Storyteller-only setting is in Storyteller settings). Other features register theirs
// the same way from their own modules.
// Board and Tokens live beside the real board, in the game pane's More > Theme (Trevor,
// 2026-11-18: "i like dropping the settings to 9"). Each section has its own reset, which puts
// back only its own settings.
registerSettingsSection({
	id: 'theme',
	label: { key: 'settings.sectionTheme' },
	icon: 'appearance',
	component: ThemeSection,
	reset: resets.theme,
	order: 10
});
registerSettingsSection({
	id: 'text',
	label: { key: 'settings.sectionText' },
	icon: 'fonts',
	component: TextSection,
	reset: resets.text,
	order: 15
});
registerSettingsSection({
	id: 'icons',
	label: { key: 'settings.icons' },
	icon: 'icons',
	component: IconsSection,
	reset: resets.icons,
	order: 20
});
registerSettingsSection({
	id: 'assistance',
	label: { key: 'settings.storyteller' },
	icon: 'assistance',
	component: AssistanceSection,
	reset: resets.assistance,
	order: 35
});
registerSettingsSection({
	// The interface language, per device (Trevor, 2026-10-25: English only for now).
	id: 'language',
	label: { key: 'settings.sectionLanguage' },
	icon: 'language',
	component: LanguageSection,
	order: 80
});
registerSettingsSection({
	id: 'data',
	label: { key: 'settings.data' },
	icon: 'data',
	component: DataSection,
	order: 90
});
