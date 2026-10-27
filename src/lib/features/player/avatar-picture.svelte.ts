import { cropRect, type AvatarCrop } from '#lib/core/avatars/crop.ts';
import { AVATAR_PICTURE_SIDE } from '#lib/core/sync/room-pictures.ts';
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

/**
 * The player's own avatar picture (Trevor, 2026-10-27: "allow setting users profile/icon in the
 * player settings"): picked from the device, cut to the square chosen on the crop screen and shrunk, and kept on this device
 * only. A room the phone joins gets a copy (core/sync/room-pictures.ts), shown on its seat in
 * place of the initials until the Storyteller takes it away for a game.
 */
const KEY = 'grim-games:player-picture:v1';

/** The picture's chosen square (core/avatars/crop.ts), shrunk to AVATAR_PICTURE_SIDE, as a JPEG. */
async function squareDataUrl(file: Blob, crop: AvatarCrop): Promise<string> {
	const bitmap = await createImageBitmap(file);
	const rect = cropRect(crop, bitmap);
	const side = Math.max(1, Math.round(Math.min(AVATAR_PICTURE_SIDE, rect.side)));
	const canvas = document.createElement('canvas');
	canvas.width = side;
	canvas.height = side;
	const ctx = canvas.getContext('2d');
	ctx?.drawImage(bitmap, rect.x, rect.y, rect.side, rect.side, 0, 0, side, side);
	bitmap.close();
	return canvas.toDataURL('image/jpeg', 0.85);
}

async function dataUrlBlob(url: string): Promise<Blob> {
	const [head, data] = url.split(',');
	const type = head.match(/^data:([^;]+)/)?.[1] ?? 'image/jpeg';
	return new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type });
}

class AvatarPicture {
	#url = $state<string | undefined>(readStoredText(KEY));
	#blob: { url: string; blob: Promise<Blob> } | undefined;

	/** The picture as a data URL, to draw; undefined while the player uses their initials. */
	get url(): string | undefined {
		return this.#url;
	}

	/** The picture's bytes, to upload to a room. */
	blob(): Promise<Blob> | undefined {
		const url = this.#url;
		if (!url) return undefined;
		if (this.#blob?.url !== url) this.#blob = { url, blob: dataUrlBlob(url) };
		return this.#blob.blob;
	}

	/** Keeps the chosen square of a picture from the device; false when it can't be read or kept. */
	async choose(file: Blob, crop: AvatarCrop): Promise<boolean> {
		try {
			const url = await squareDataUrl(file, crop);
			if (!writeStoredText(KEY, url)) return false;
			this.#url = url;
			return true;
		} catch {
			return false;
		}
	}

	clear(): void {
		writeStoredText(KEY, undefined);
		this.#url = undefined;
	}
}

export const avatarPicture = new AvatarPicture();
