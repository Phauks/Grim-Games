/**
 * The settings profiles on this device (plan S18). The usual stores (preferences, board looks,
 * reminder bank focus, the background for all games) stay the working copy every screen
 * reads; this store keeps the active profile equal to them. A change to a setting is saved
 * straight into the active profile (edit in place, no "modified" state), and switching profile
 * writes that profile's values into those stores.
 *
 * Profiles sync with a signed-in account, one document per profile, like character
 * collections. Which profile is the default and which is in use stay with the device.
 */
import { untrack } from 'svelte';
import { account } from '#lib/features/account/account.svelte.ts';
import type { ProfileDoc } from '#lib/features/account/account-protocol.ts';
import { firstSignIn } from '#lib/features/account/first-sign-in.svelte.ts';
import { accountSync } from '#lib/features/account/sync/sync.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import {
	clearBackground,
	readBackground,
	saveBackground,
	type BackgroundChoice
} from '#lib/features/grimoire/backgrounds.ts';
import { boardBackground } from '#lib/features/grimoire/board-background.svelte.ts';
import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
import { defaultBackground } from '#lib/features/grimoire/default-background.svelte.ts';
import { stepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
import { linkedTo, markLinked } from '#lib/features/library/library-sync.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	backgroundRef,
	cleanName,
	freeName,
	parseGameProfiles,
	parseProfileBody,
	parseProfilesState,
	parseProfileValues,
	profileBody,
	sameValues,
	withoutDevicePreferences,
	withoutProfile,
	type ProfilesState,
	type ProfileValues,
	type SettingsProfile
} from './profile-values.ts';

export const PROFILES_STORAGE_KEY = 'grim-games:settings-profiles:v1';
/** Which profile each game uses (device only, like a game's own background). */
const GAMES_KEY = 'grim-games:game-profiles:v1';
const KIND = 'settings-profile';
const LINKED_KEY = 'grim-games:settings-profiles-linked';
/** This device's profiles from before it followed an account whose sheet said no (kept). */
const SET_ASIDE_KEY = 'grim-games:settings-profiles-before-sync';

/** The settings in use now, as a profile keeps them. */
function liveValues(background: BackgroundChoice | undefined): ProfileValues {
	return {
		preferences: withoutDevicePreferences(preferences.current),
		boardLooks: boardLooks.current,
		stepFocus: stepFocus.current,
		background: backgroundRef(background)
	};
}

const fromDoc = (doc: ProfileDoc): SettingsProfile | undefined =>
	parseProfileBody(doc.body, doc.id);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

accountSync.register(KIND, {
	copy: (raw) => {
		const read = parseProfileBody(raw, 'copy');
		return read
			? profileBody({ ...read, name: t('account.sync.otherDevice', { name: read.name }) })
			: raw;
	}
});

/**
 * What was stored, whether it may be written (not when a newer build wrote it), and whether it
 * is on the device yet (not on first run until something is saved).
 */
function read(): { state: ProfilesState; writable: boolean; kept: boolean } {
	const raw = readStored(PROFILES_STORAGE_KEY);
	const state = parseProfilesState(raw);
	if (state) return { state, writable: true, kept: true };
	// First run: the settings in use become the first profile.
	const id = crypto.randomUUID();
	const first: ProfilesState = {
		schemaVersion: 1,
		profiles: [{ id, name: t('settings.profileFirstName'), values: liveValues(undefined) }],
		defaultId: id,
		activeId: id
	};
	const newer =
		raw !== undefined &&
		typeof raw === 'object' &&
		raw !== null &&
		(raw as { schemaVersion?: unknown }).schemaVersion !== 1;
	return { state: first, writable: !newer, kept: false };
}

class SettingsProfiles {
	#stored = read();
	#state = $state.raw<ProfilesState>(this.#stored.state);
	#games = $state.raw(parseGameProfiles(readStored(GAMES_KEY)));
	/** The background for all games has been read, so the active profile can follow it. */
	#ready = $state(false);
	/** A switch is writing another profile's values; they aren't edits to record. */
	#switching = $state(false);
	/** Changes made here that the account's copy on this device doesn't show yet. */
	#pending = $state(0);
	/** The profile New game chose for the game about to start. */
	#nextGame: string | undefined;

	get list(): readonly SettingsProfile[] {
		return this.#state.profiles;
	}

	get defaultId(): string {
		return this.#state.defaultId;
	}

	get activeId(): string {
		return this.#state.activeId;
	}

	/** Which profile each game uses, by game id. */
	get gameProfiles(): Readonly<Record<string, string>> {
		return this.#games;
	}

	get(id: string): SettingsProfile | undefined {
		return this.#state.profiles.find((p) => p.id === id);
	}

	constructor() {
		if (typeof window === 'undefined') return;
		void defaultBackground.load().finally(() => (this.#ready = true));
		$effect.root(() => {
			// Edit in place: whatever changes in the working copy is saved in the active profile.
			$effect(() => {
				if (!this.#ready || this.#switching) return;
				const values = liveValues(defaultBackground.current);
				untrack(() => this.#record(values));
			});
			$effect(() => {
				const user = account.user;
				if (!user || !accountSync.ready || !accountSync.enabled(KIND)) return;
				const docs = accountSync.docs(KIND);
				const pulled = accountSync.pulled;
				if (this.#pending > 0 || !this.#ready || this.#switching) return;
				untrack(() => this.#follow(user.id, docs, pulled));
			});
		});
	}

	#record(values: ProfileValues): void {
		const active = this.get(this.activeId);
		if (!active || sameValues(active.values, values)) return;
		this.#replace({ ...active, values });
	}

	#replace(profile: SettingsProfile): void {
		this.#save({
			...this.#state,
			profiles: this.#state.profiles.map((p) => (p.id === profile.id ? profile : p))
		});
	}

	// ── Account sync ──

	/** The account's profiles, or undefined while one is from a newer build. */
	#theirs(): SettingsProfile[] | undefined {
		const docs = accountSync.docs(KIND);
		const theirs = docs.flatMap((doc) => fromDoc(doc) ?? []);
		return theirs.length < docs.length ? undefined : theirs;
	}

	/**
	 * This device's profiles the account doesn't have (the first sign-in sheet's offer). One
	 * still at the app's defaults adds nothing, so it isn't offered or added.
	 */
	#mine(theirs: readonly SettingsProfile[]): SettingsProfile[] {
		const ids = new Set(theirs.map((p) => p.id));
		const untouched = parseProfileValues(null);
		return this.#state.profiles.filter((p) => !ids.has(p.id) && !sameValues(p.values, untouched));
	}

	offerCount(): number {
		const theirs = this.#theirs();
		return theirs ? this.#mine(theirs).length : 0;
	}

	/** The sheet said yes: this device's profiles join the account's. */
	join(userId: string): void {
		const theirs = this.#theirs();
		if (!theirs) return;
		// An account with no profiles yet takes all of this device's, untouched ones too.
		const mine = theirs.length ? this.#mine(theirs) : this.#state.profiles;
		for (const p of mine) this.#push(p.id, p);
		this.#adopt([...mine, ...theirs]);
		markLinked(LINKED_KEY, userId);
	}

	/** The sheet said no: this device's profiles are set aside and the account's used. */
	setAside(userId: string): void {
		const theirs = this.#theirs();
		if (!theirs) return;
		// An account with no profiles yet has nothing to follow: the device's join it.
		if (theirs.length === 0) return this.join(userId);
		if (this.#stored.writable && !writeStored(SET_ASIDE_KEY, this.#state)) return;
		this.#adopt(theirs);
		markLinked(LINKED_KEY, userId);
	}

	/** Keeps this device in step with the signed-in account's profiles. */
	#follow(userId: string, docs: ProfileDoc[], pulled: boolean): void {
		const theirs = docs.flatMap((doc) => fromDoc(doc) ?? []);
		// One from a newer build is left alone, and so is the whole list until this build can read it.
		if (theirs.length < docs.length) return;
		if (!linkedTo(LINKED_KEY, userId)) {
			if (!pulled) return;
			// Something to add waits for the first sign-in sheet's answer.
			if (this.offerCount() > 0 && !firstSignIn.answered(userId)) return;
			this.join(userId);
			return;
		}
		// Every profile deleted elsewhere: this device keeps its own and adds them back.
		if (theirs.length === 0) {
			for (const p of this.#state.profiles) this.#push(p.id, p);
			return;
		}
		const order = new Map(this.#state.profiles.map((p, i) => [p.id, i]));
		const next = [...theirs].sort(
			(a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
		);
		if (!same(next, this.#state.profiles)) this.#adopt(next);
	}

	/** Uses the account's list; the profile in use is applied again if it changed. */
	#adopt(profiles: SettingsProfile[]): void {
		const known = (id: string) => profiles.some((p) => p.id === id);
		const defaultId = known(this.defaultId) ? this.defaultId : profiles[0].id;
		const activeId = known(this.activeId) ? this.activeId : defaultId;
		const before = this.get(this.activeId);
		this.#save({ ...this.#state, profiles, defaultId, activeId }, { fromAccount: true });
		const after = this.get(activeId);
		if (after && (activeId !== before?.id || !sameValues(after.values, before.values))) {
			void this.#apply(after, activeId === before?.id);
		}
	}

	#push(id: string, profile: SettingsProfile | undefined): void {
		this.#pending++;
		const sent = profile
			? accountSync.save(KIND, id, profileBody(profile))
			: accountSync.remove(KIND, id);
		void sent.finally(() => this.#pending--);
	}

	#save(next: ProfilesState, { fromAccount = false } = {}): void {
		if (next === this.#state) return;
		const before = this.#state;
		this.#state = next;
		const user = account.user;
		// Before this device has joined the account, its changes stay here.
		if (
			!fromAccount &&
			user &&
			linkedTo(LINKED_KEY, user.id) &&
			this.#stored.writable &&
			accountSync.enabled(KIND)
		) {
			const old = new Map(before.profiles.map((p) => [p.id, p]));
			for (const p of next.profiles) if (!same(old.get(p.id), p)) this.#push(p.id, p);
			const kept = new Set(next.profiles.map((p) => p.id));
			for (const id of old.keys()) if (!kept.has(id)) this.#push(id, undefined);
		}
		if (!this.#stored.writable) return;
		this.#stored.kept = true;
		if (!writeStored(PROFILES_STORAGE_KEY, next)) {
			reportError(new Error('Settings profiles were not saved on this device'), {
				area: 'settings'
			});
		}
	}

	// ── Switching ──

	/**
	 * Writes a profile's values into the working copy, keeping the device's own settings.
	 * `again`: the profile was already in use, so a picture on the board is already its own.
	 */
	async #apply(profile: SettingsProfile, again = false): Promise<void> {
		this.#switching = true;
		try {
			const { values } = profile;
			const { allowZoom, soundVolume, speaker } = preferences.current;
			preferences.update({ ...values.preferences, allowZoom, soundVolume, speaker });
			boardLooks.update(values.boardLooks);
			stepFocus.update(values.stepFocus);
			// A picture is only on the device that added it; elsewhere the board is plain.
			const choice: BackgroundChoice | undefined =
				values.background.kind === 'image'
					? again && defaultBackground.current?.kind === 'image'
						? defaultBackground.current
						: await readBackground({ profileId: profile.id })
					: values.background.kind === 'none'
						? undefined
						: values.background;
			if (choice) await saveBackground('default', choice);
			else await clearBackground('default');
			defaultBackground.set(choice);
			boardBackground.context?.onChange();
		} catch (e) {
			reportError(e, { area: 'settings', notify: false });
		} finally {
			this.#switching = false;
		}
	}

	/** Uses another profile now; the one in use keeps its picture for when it comes back. */
	async use(id: string): Promise<void> {
		const next = this.get(id);
		if (!next || id === this.activeId || this.#switching) return;
		const leaving = this.activeId;
		try {
			const picture = await readBackground('default');
			if (picture?.kind === 'image') await saveBackground({ profileId: leaving }, picture);
		} catch (e) {
			reportError(e, { area: 'settings', notify: false });
		}
		this.#save({ ...this.#state, activeId: id });
		await this.#apply(next);
		const gameId = boardBackground.context?.gameId;
		// Switched with a board open (its Board or Tokens sheet): that game now uses it.
		if (gameId) this.#setGame(gameId, id);
	}

	// ── Games ──

	/** New game's choice for the game it is about to start. */
	chooseForNextGame(id: string): void {
		this.#nextGame = id;
	}

	/**
	 * A board opened: a game uses the profile it was started or last played with, and a new
	 * one the profile New game chose (else the one in use).
	 */
	openGame(gameId: string): void {
		const saved = this.#games[gameId];
		if (saved && this.get(saved)) {
			void this.use(saved);
			return;
		}
		const chosen = this.#nextGame && this.get(this.#nextGame) ? this.#nextGame : this.activeId;
		this.#nextGame = undefined;
		this.#setGame(gameId, chosen);
		void this.use(chosen);
	}

	#setGame(gameId: string, profileId: string): void {
		if (this.#games[gameId] === profileId) return;
		// The first run's profile is made afresh on each visit until it is saved: save it now, so
		// the game keeps naming it (and its row counts the game).
		if (!this.#stored.kept) this.#save({ ...this.#state });
		this.#games = { ...this.#games, [gameId]: profileId };
		writeStored(GAMES_KEY, this.#games);
	}

	// ── Managing ──

	/** A new profile with the app's default settings; returns its id. */
	add(): string {
		const id = crypto.randomUUID();
		const name = freeName(t('settings.profileNewName'), this.list);
		this.#save({
			...this.#state,
			profiles: [...this.#state.profiles, { id, name, values: parseProfileValues(null) }]
		});
		return id;
	}

	/** A copy of a profile, its picture too; returns the copy's id. */
	async duplicate(id: string): Promise<string | undefined> {
		const from = this.get(id);
		if (!from) return undefined;
		const copy: SettingsProfile = {
			id: crypto.randomUUID(),
			name: freeName(t('settings.profileCopyName', { name: from.name }), this.list),
			values: from.values
		};
		if (from.values.background.kind === 'image') {
			try {
				const picture = await readBackground(id === this.activeId ? 'default' : { profileId: id });
				if (picture) await saveBackground({ profileId: copy.id }, picture);
			} catch (e) {
				reportError(e, { area: 'settings', notify: false });
			}
		}
		const at = this.#state.profiles.findIndex((p) => p.id === id);
		const profiles = [...this.#state.profiles];
		profiles.splice(at + 1, 0, copy);
		this.#save({ ...this.#state, profiles });
		return copy.id;
	}

	rename(id: string, name: string): void {
		const profile = this.get(id);
		const cleaned = cleanName(name);
		if (!profile || !cleaned || cleaned === profile.name) return;
		this.#replace({ ...profile, name: cleaned });
	}

	makeDefault(id: string): void {
		if (this.get(id)) this.#save({ ...this.#state, defaultId: id });
	}

	/** Deletes a profile (never the last); if it was in use, the default takes over. */
	async remove(id: string): Promise<void> {
		const next = withoutProfile(this.#state, id);
		if (next === this.#state) return;
		const wasActive = id === this.activeId;
		this.#save(next);
		void clearBackground({ profileId: id }).catch(() => undefined);
		const target = this.get(next.activeId);
		if (wasActive && target) await this.#apply(target);
	}
}

export const settingsProfiles = new SettingsProfiles();

firstSignIn.register(KIND, {
	async count() {
		return settingsProfiles.offerCount();
	},
	async upload() {
		if (account.user) settingsProfiles.join(account.user.id);
	},
	async skip() {
		if (account.user) settingsProfiles.setAside(account.user.id);
	}
});
