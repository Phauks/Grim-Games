import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
import SoundSection from './SoundSection.svelte';

// Every sound's settings in one section (plan U1, settings registry: features add their own).
// The moments', day and night sounds and vibration follow the account; the volume and speaker stay with the device.
registerSettingsSection({
	id: 'sound',
	label: { key: 'settings.sectionSound' },
	icon: 'sound',
	component: SoundSection,
	reset: () =>
		preferences.update({
			soundVolume: DEFAULT_PREFERENCES.soundVolume,
			timerVibrate: DEFAULT_PREFERENCES.timerVibrate,
			ambienceOn: DEFAULT_PREFERENCES.ambienceOn,
			ambienceLevel: DEFAULT_PREFERENCES.ambienceLevel,
			nightAmbience: DEFAULT_PREFERENCES.nightAmbience,
			dayAmbience: DEFAULT_PREFERENCES.dayAmbience,
			momentSounds: DEFAULT_PREFERENCES.momentSounds,
			soundOutput: DEFAULT_PREFERENCES.soundOutput,
			speaker: DEFAULT_PREFERENCES.speaker
		}),
	order: 36
});
