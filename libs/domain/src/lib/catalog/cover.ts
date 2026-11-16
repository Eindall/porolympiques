/** Taille maximale d'une image de jeu envoyée par un joueur. */
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

export type CoverType = 'image/png' | 'image/jpeg' | 'image/webp';

export const COVER_EXTENSIONS: Readonly<Record<CoverType, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Type d'une image d'après ses premiers octets (sa signature), jamais d'après son nom ou ce qu'annonce le
 * navigateur. `null` si ce n'est ni un PNG, ni un JPEG, ni un WebP.
 */
export function detectCoverType(bytes: Uint8Array): CoverType | null {
  const starts = (signature: number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // « RIFF », taille sur 4 octets, puis « WEBP ».
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

/** Type d'une image déjà stockée, d'après l'extension que lui a donnée le stockage. */
export function coverTypeOfFile(fileName: string): CoverType | null {
  const extension = fileName.split('.').pop();
  const entry = Object.entries(COVER_EXTENSIONS).find(([, ext]) => ext === extension);
  return entry ? (entry[0] as CoverType) : null;
}
