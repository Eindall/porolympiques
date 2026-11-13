/**
 * Codes d'erreur passés à `/login?error=…` à la fin d'un flux OAuth raté.
 * - `not_member` : la personne n'est pas (ou plus) sur le serveur Discord ;
 * - `state` : le flux a expiré ou a été falsifié ;
 * - `discord` : Discord a refusé, l'utilisateur a annulé, ou le bot n'a pas pu vérifier la présence.
 */
export type AuthErrorCode = 'not_member' | 'state' | 'discord';
