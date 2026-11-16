import type { PublicLook } from '#lib/core/sync/public-projection.ts';
import { readStored } from '#lib/ui/stored.ts';
import { STORAGE_KEY, type StoredRoom } from './host-storage.ts';
import { uploadRoomImage } from './room-images.ts';

/**
 * The open board's look and shape, as every grim drawn from it shares them (the players'
 * grim, Public Town, Grim view): its background, vignette and logo, its own picture once
 * uploaded to the room, and its width ÷ height.
 */
export class BoardLook {
	#look = $state<{ gameId: string; look: PublicLook }>();
	/** The board's own picture while its look has one, and its name in the room once uploaded. */
	#picture = $state.raw<Blob>();
	#uploaded = $state.raw<{ picture: Blob; code: string; hash: string }>();
	#aspect = $state.raw<{ gameId: string; aspect: number }>();

	show(gameId: string, look: PublicLook, picture: Blob | undefined, code: string | undefined) {
		const shown = { gameId, look: $state.snapshot(look) as PublicLook };
		if (JSON.stringify(shown) !== JSON.stringify(this.#look)) this.#look = shown;
		this.#picture = look.background === 'image' ? picture : undefined;
		this.upload(code);
	}

	/** Uploads the board's picture to the open room `code`, once, so the table's grims show it. */
	upload(code: string | undefined): void {
		const picture = this.#picture;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!picture || !code || stored?.code !== code) return;
		if (this.#uploaded?.picture === picture && this.#uploaded.code === code) return;
		uploadRoomImage(code, stored.key, picture)
			.then((hash) => {
				if (this.#picture === picture) this.#uploaded = { picture, code, hash };
			})
			// Not shared until the next try (a new look, or the room again): no background.
			.catch(() => undefined);
	}

	/** The board's look, while it is this game's, with its picture's name in room `code`. */
	lookOf(gameId: string, code: string | undefined): { look?: PublicLook } {
		if (this.#look?.gameId !== gameId) return {};
		const { look } = this.#look;
		const uploaded = this.#uploaded;
		const named =
			look.background === 'image' && uploaded?.picture === this.#picture && uploaded?.code === code;
		return { look: named ? { ...look, image: uploaded!.hash } : look };
	}

	showAspect(gameId: string, aspect: number | undefined): void {
		if (aspect === undefined) return;
		if (this.#aspect?.gameId !== gameId || this.#aspect.aspect !== aspect)
			this.#aspect = { gameId, aspect };
	}

	aspectOf(gameId: string): { aspect?: number } {
		return this.#aspect?.gameId === gameId ? { aspect: this.#aspect.aspect } : {};
	}
}
