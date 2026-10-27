import { cropRect, type AvatarCrop } from '#lib/core/avatars/crop.ts';
import { AVATAR_PICTURE_SIDE } from '#lib/core/sync/room-pictures.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';

/**
 * The player's own avatar picture (Trevor, 2026-10-27: "allow setting users profile/icon in the
 * player settings"): picked from the device, cut to the square chosen on the crop screen and shrunk, and kept on this device
 * only. A room the phone joins gets a copy (core/sync/room-pictures.ts), shown on its seat in
 * place of the initials until the Storyteller takes it away for a game.
 */
const KEY = 'grim-games:player-picture:v1';
/**
 * The whole picture it was cut from, shrunk to ORIGINAL_SIDE, and the crop chosen on it, so
 * tapping the picture opens the crop screen again (Trevor, 2026-10-27: "Allow clicking on picture
 * in player settings to preview and edit crop and placement"). A picture kept before these has
 * neither: its crop screen starts from the picture itself.
 */
const ORIGINAL_KEY = 'grim-games:player-picture-original:v1';
const CROP_KEY = 'grim-games:player-picture-crop:v1';
const ORIGINAL_SIDE = 1024;

/** The picture shrunk to fit ORIGINAL_SIDE, as a JPEG data URL, and how much it was shrunk. */
async function shrunkDataUrl(file: Blob): Promise<{ url: string; scale: number }> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, ORIGINAL_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return { url: canvas.toDataURL('image/jpeg', 0.85), scale };
}

function readCrop(): AvatarCrop | undefined {
	const raw = readStored<Partial<AvatarCrop>>(CROP_KEY);
	const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
	return raw && ok(raw.zoom) && ok(raw.x) && ok(raw.y) ? (raw as AvatarCrop) : undefined;
}

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

	/**
	 * The whole picture to crop again, and the crop last chosen on it; the kept picture itself
	 * for one saved before the whole picture was kept.
	 */
	async editable(): Promise<{ file: Blob; crop?: AvatarCrop } | undefined> {
		const original = readStoredText(ORIGINAL_KEY);
		const url = original ?? this.#url;
		if (!url) return undefined;
		return { file: await dataUrlBlob(url), crop: original ? readCrop() : undefined };
	}

	/** Keeps the chosen square of a picture from the device; false when it can't be read or kept. */
	async choose(file: Blob, crop: AvatarCrop): Promise<boolean> {
		try {
			const url = await squareDataUrl(file, crop);
			const original = await shrunkDataUrl(file);
			if (!writeStoredText(KEY, url)) return false;
			this.#url = url;
			// The whole picture only helps a later edit: a full storage still keeps the avatar.
			const { scale } = original;
			const kept = { zoom: crop.zoom, x: crop.x * scale, y: crop.y * scale };
			if (writeStoredText(ORIGINAL_KEY, original.url)) writeStored(CROP_KEY, kept);
			else writeStored(CROP_KEY, undefined);
			return true;
		} catch {
			return false;
		}
	}

	clear(): void {
		writeStoredText(KEY, undefined);
		writeStoredText(ORIGINAL_KEY, undefined);
		writeStored(CROP_KEY, undefined);
		this.#url = undefined;
	}
}

export const avatarPicture = new AvatarPicture();
