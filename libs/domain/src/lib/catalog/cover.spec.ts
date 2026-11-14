import { JPEG_BYTES, PNG_BYTES, WEBP_BYTES } from '../ideas/test-helpers';
import { coverTypeOfFile, detectCoverType } from './cover';

describe('detectCoverType', () => {
  it.each([
    ['PNG', PNG_BYTES, 'image/png'],
    ['JPEG', JPEG_BYTES, 'image/jpeg'],
    ['WebP', WEBP_BYTES, 'image/webp'],
  ])('reconnaît un %s à sa signature', (_name, bytes, type) => {
    expect(detectCoverType(bytes)).toBe(type);
  });

  it.each([
    ['du texte renommé en .png', new TextEncoder().encode('<svg onload="alert(1)">')],
    ['un GIF', new TextEncoder().encode('GIF89a......')],
    ['un RIFF qui n’est pas du WebP (WAV)', new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])],
    ['un fichier vide', new Uint8Array()],
    ['un PNG tronqué', PNG_BYTES.slice(0, 4)],
  ])('refuse %s', (_name, bytes) => {
    expect(detectCoverType(bytes)).toBeNull();
  });
});

describe('coverTypeOfFile', () => {
  it('retrouve le type d’après l’extension donnée par le stockage', () => {
    expect(['a.png', 'b.jpg', 'c.webp', 'd.gif', 'sans-extension'].map(coverTypeOfFile)).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      null,
      null,
    ]);
  });
});
