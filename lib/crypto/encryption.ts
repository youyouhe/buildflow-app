import CryptoJS from 'crypto-js';

const SALT = 'buildflow-v1-salt-2025';

/**
 * Encrypt a string using AES-256 with a user-specific key
 * @param plaintext The text to encrypt
 * @param userKey The user's unique key (e.g., GitHub token)
 * @returns Encrypted string
 */
export function encrypt(plaintext: string, userKey: string): string {
  // Derive a key from the user's token using PBKDF2
  const key = CryptoJS.PBKDF2(userKey, SALT, {
    keySize: 256 / 32,
    iterations: 1000,
  });
  
  // Encrypt using AES
  return CryptoJS.AES.encrypt(plaintext, key.toString()).toString();
}

/**
 * Decrypt a string that was encrypted with encrypt()
 * @param ciphertext The encrypted text
 * @param userKey The user's unique key (must be the same as used for encryption)
 * @returns Decrypted string
 */
export function decrypt(ciphertext: string, userKey: string): string {
  // Derive the same key
  const key = CryptoJS.PBKDF2(userKey, SALT, {
    keySize: 256 / 32,
    iterations: 1000,
  });
  
  // Decrypt
  const bytes = CryptoJS.AES.decrypt(ciphertext, key.toString());
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Hash a string (one-way, cannot be decrypted)
 * Useful for comparing values without storing them
 */
export function hash(input: string): string {
  return CryptoJS.SHA256(input).toString();
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}
