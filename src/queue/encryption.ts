import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

export class EncryptionHelper {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly TAG_LENGTH = 16; // 128 bits tag

  /**
   * Encrypts plaintext string using AES-256-GCM
   * @param text Plaintext to encrypt
   * @param keyHex 32-byte key formatted as a hex string (64 characters)
   */
  public static encrypt(text: string, keyHex: string): string {
    try {
      const key = Buffer.from(keyHex, 'hex');
      if (key.length !== 32) {
        throw new Error(`Invalid key size: ${key.length} bytes (must be 32 bytes)`);
      }

      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Output format: iv(hex) + authTag(hex) + ciphertext(hex)
      return iv.toString('hex') + authTag.toString('hex') + encrypted;
    } catch (error: any) {
      Logger.error(`Encryption error: ${error.message || error}`);
      throw error;
    }
  }

  /**
   * Decrypts ciphertext string using AES-256-GCM
   * @param encryptedData Hex string matching IV + AuthTag + Ciphertext format
   * @param keyHex 32-byte key formatted as a hex string (64 characters)
   */
  public static decrypt(encryptedData: string, keyHex: string): string {
    try {
      const key = Buffer.from(keyHex, 'hex');
      if (key.length !== 32) {
        throw new Error(`Invalid key size: ${key.length} bytes (must be 32 bytes)`);
      }

      // Convert hex strings to buffers
      const ivHex = encryptedData.substring(0, this.IV_LENGTH * 2);
      const tagHex = encryptedData.substring(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2);
      const ciphertextHex = encryptedData.substring((this.IV_LENGTH + this.TAG_LENGTH) * 2);

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext).toString('utf8');
      decrypted += decipher.final().toString('utf8');

      return decrypted;
    } catch (error: any) {
      Logger.error(`Decryption error: ${error.message || error}`);
      throw error;
    }
  }

  /**
   * Generates a random 32-byte key as a hex string (64 characters)
   */
  public static generateRandomKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
