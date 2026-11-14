import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiskCoverStorage } from './disk-cover-storage';

describe('DiskCoverStorage', () => {
  let dir: string;
  let storage: DiskCoverStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'poro-covers-'));
    storage = new DiskCoverStorage(dir);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('enregistre sous un nom aléatoire, relit et supprime', async () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const name = await storage.save(bytes, 'png');

    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readdir(join(dir, 'covers'))).toEqual([name]);
    expect(await storage.read(name)).toEqual(bytes);
    await storage.remove(name);
    expect(await storage.read(name)).toBeNull();
    await expect(storage.remove(name)).resolves.toBeUndefined();
  });

  it('refuse les noms qu’il n’a pas créés, pour ne jamais sortir de son dossier', async () => {
    await writeFile(join(dir, 'secret.png'), 'secret');

    expect(await storage.read('../secret.png')).toBeNull();
    await storage.remove('../secret.png');
    expect(await readdir(dir)).toContain('secret.png');
    await expect(storage.save(new Uint8Array([1]), 'svg')).rejects.toThrow('Extension');
  });
});
