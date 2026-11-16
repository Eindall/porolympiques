import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CoverStorage } from '@porolympiques/domain';

/** Nom d'un fichier créé par ce stockage : un UUID et une extension. Tout autre nom est refusé (pas de `../`). */
const FILE_NAME = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;

/**
 * Images de jeux sur disque, dans un dossier dédié (`UPLOADS_DIR`). Les fichiers portent un nom aléatoire :
 * le nom envoyé par le joueur n'est jamais utilisé.
 */
export class DiskCoverStorage implements CoverStorage {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir, 'covers');
  }

  async save(bytes: Uint8Array, extension: string): Promise<string> {
    const fileName = `${randomUUID()}.${extension}`;
    if (!FILE_NAME.test(fileName)) throw new Error(`Extension d'image inattendue : ${extension}`);
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, fileName), bytes, { flag: 'wx' });
    return fileName;
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    if (!FILE_NAME.test(fileName)) return null;
    try {
      return new Uint8Array(await readFile(join(this.dir, fileName)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(fileName: string): Promise<void> {
    if (!FILE_NAME.test(fileName)) return;
    await rm(join(this.dir, fileName), { force: true });
  }
}
