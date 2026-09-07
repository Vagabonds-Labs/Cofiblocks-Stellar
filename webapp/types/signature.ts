/**
 * Formato SEP-53 para firmar mensajes.
 *
 * La wallet antepone este prefijo y hashea con SHA-256 antes de firmar, así un
 * mensaje firmado nunca puede pasar por una transacción firmada. El backend
 * verifica lo mismo en local con la clave pública ed25519 de la cuenta.
 */
export const SEP53_PREFIX = 'Stellar Signed Message:\n'
