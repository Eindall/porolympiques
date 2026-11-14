/** Port du stockage des images de jeux envoyées par les joueurs (implémenté par `database`, sur disque). */
export interface CoverStorage {
  /** Enregistre l'image sous un nom aléatoire, avec cette extension ; renvoie le nom du fichier. */
  save(bytes: Uint8Array, extension: string): Promise<string>;
  /** `null` si le fichier n'existe pas. */
  read(fileName: string): Promise<Uint8Array | null>;
  /** Sans effet si le fichier n'existe pas. */
  remove(fileName: string): Promise<void>;
}

export const COVER_STORAGE = Symbol('CoverStorage');
