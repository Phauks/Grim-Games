/**
 * Which part of a picture a player's avatar shows (Trevor, 2026-10-27: "Setting an image as an
 * avatar needs additional screen so players can identify the exact contours of the picture they
 * want used"). The avatar is a circle in a square; the crop is that square in the picture, by its
 * centre (in the picture's own pixels) and a zoom, where zoom 1 is the largest square that fits.
 * The square always stays inside the picture, so the avatar has no empty edge.
 */

export const MAX_AVATAR_ZOOM = 4;

export interface AvatarCrop {
	zoom: number;
	/** The square's centre, in the picture's pixels. */
	x: number;
	y: number;
}

export interface PictureSize {
	width: number;
	height: number;
}

/** The square's side, in the picture's pixels. */
export function cropSide(crop: AvatarCrop, size: PictureSize): number {
	return Math.min(size.width, size.height) / crop.zoom;
}

/** The crop with its zoom in range and its square inside the picture. */
export function clampCrop(crop: AvatarCrop, size: PictureSize): AvatarCrop {
	const zoom = Math.min(MAX_AVATAR_ZOOM, Math.max(1, crop.zoom));
	const half = Math.min(size.width, size.height) / zoom / 2;
	const within = (value: number, length: number) => Math.min(length - half, Math.max(half, value));
	return { zoom, x: within(crop.x, size.width), y: within(crop.y, size.height) };
}

/** The middle of the picture, as large as fits: what the avatar showed before this screen. */
export function centredCrop(size: PictureSize): AvatarCrop {
	return { zoom: 1, x: size.width / 2, y: size.height / 2 };
}

/**
 * The crop after a drag of the picture by `dx`, `dy`, as fractions of the square's side on
 * screen: the picture follows the finger, so the square moves the other way.
 */
export function panCrop(crop: AvatarCrop, size: PictureSize, dx: number, dy: number): AvatarCrop {
	const side = cropSide(crop, size);
	return clampCrop({ ...crop, x: crop.x - dx * side, y: crop.y - dy * side }, size);
}

/** The crop at another zoom, about the same centre. */
export function zoomCrop(crop: AvatarCrop, size: PictureSize, zoom: number): AvatarCrop {
	return clampCrop({ ...crop, zoom }, size);
}

/** The square to cut from the picture: its top-left corner and side, in its pixels. */
export function cropRect(crop: AvatarCrop, size: PictureSize) {
	const c = clampCrop(crop, size);
	const side = cropSide(c, size);
	return { x: c.x - side / 2, y: c.y - side / 2, side };
}

/**
 * Where the whole picture sits on screen behind the square, as percentages of the square's
 * side (no pixel sizes): its left and top edges and its width and height.
 */
export function cropView(crop: AvatarCrop, size: PictureSize) {
	const rect = cropRect(crop, size);
	const scale = 100 / rect.side;
	return {
		left: -rect.x * scale,
		top: -rect.y * scale,
		width: size.width * scale,
		height: size.height * scale
	};
}
