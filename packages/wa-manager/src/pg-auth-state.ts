import { proto } from '@whiskeysockets/baileys/WAProto/index.js';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataSet, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { encryptJSON, decryptJSON } from '@dispara/shared';

const WA_ENCRYPTION_KEY = process.env.WA_ENCRYPTION_KEY || '';

if (!WA_ENCRYPTION_KEY) {
  console.warn('[wa-manager] WARNING: WA_ENCRYPTION_KEY not set — auth keys will be stored unencrypted');
}

/**
 * Encrypt a value if WA_ENCRYPTION_KEY is available, otherwise return as-is.
 */
function encryptValue(value: unknown): unknown {
  if (!WA_ENCRYPTION_KEY) return value;
  return encryptJSON(value, WA_ENCRYPTION_KEY);
}

/**
 * Decrypt a value. Falls back to plain JSON if decryption fails (backwards compat).
 */
function decryptValue<T = unknown>(value: unknown): T {
  if (!WA_ENCRYPTION_KEY || typeof value !== 'string') return value as T;
  try {
    return decryptJSON<T>(value, WA_ENCRYPTION_KEY);
  } catch {
    // Backwards compatibility: value is likely unencrypted plain JSON
    console.warn('[wa-manager] Failed to decrypt auth key — treating as plain JSON. Consider re-encrypting.');
    return value as T;
  }
}

/**
 * PostgreSQL-backed auth state for Baileys.
 *
 * Stores creds in WaSession.authState (Json column).
 * Stores Signal keys in wa_auth_keys table (one row per type+id combo).
 *
 * This replaces useMultiFileAuthState for production use — no filesystem dependency,
 * survives container restarts, and supports multi-node deployments.
 */
export async function usePostgresAuthState(
  prisma: PrismaClient,
  sessionId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  // ── Load or initialize creds ──
  const session = await prisma.waSession.findUniqueOrThrow({ where: { id: sessionId } });
  const rawCreds = session.authState as Record<string, unknown> | null;

  let creds: AuthenticationCreds;
  if (rawCreds && Object.keys(rawCreds).length > 0) {
    // Deserialize with BufferJSON.reviver to restore Uint8Array/Buffer fields
    creds = JSON.parse(JSON.stringify(rawCreds), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
  }

  // ── Keys store (wa_auth_keys table) ──
  const keys = {
    get: async <T extends keyof SignalDataTypeMap>(
      type: T,
      ids: string[],
    ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
      const data: Record<string, SignalDataTypeMap[T]> = {};

      if (ids.length === 0) return data;

      const rows = await prisma.waAuthKey.findMany({
        where: {
          sessionId,
          keyType: type,
          keyId: { in: ids },
        },
      });

      for (const row of rows) {
        // Decrypt if encrypted, then deserialize with BufferJSON.reviver
        const decrypted = decryptValue(row.value);
        let value = JSON.parse(JSON.stringify(decrypted), BufferJSON.reviver);
        if (type === 'app-state-sync-key' && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        data[row.keyId] = value;
      }

      return data;
    },

    set: async (data: SignalDataSet): Promise<void> => {
      const operations: Promise<unknown>[] = [];

      for (const category in data) {
        const categoryData = data[category as keyof SignalDataSet];
        if (!categoryData) continue;

        for (const id in categoryData) {
          const value = categoryData[id];
          if (value) {
            // Upsert: insert or update (encrypt at rest)
            const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
            const encrypted = encryptValue(serialized);
            operations.push(
              prisma.waAuthKey.upsert({
                where: {
                  sessionId_keyType_keyId: {
                    sessionId,
                    keyType: category,
                    keyId: id,
                  },
                },
                create: {
                  sessionId,
                  keyType: category,
                  keyId: id,
                  value: encrypted as string,
                },
                update: {
                  value: encrypted as string,
                },
              }),
            );
          } else {
            // Delete key
            operations.push(
              prisma.waAuthKey.deleteMany({
                where: {
                  sessionId,
                  keyType: category,
                  keyId: id,
                },
              }),
            );
          }
        }
      }

      await Promise.all(operations);
    },
  };

  const saveCreds = async (): Promise<void> => {
    // Serialize creds with BufferJSON.replacer to handle Uint8Array/Buffer
    const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    await prisma.waSession.update({
      where: { id: sessionId },
      data: { authState: serialized },
    });
  };

  return {
    state: { creds, keys },
    saveCreds,
  };
}

/**
 * Remove all auth keys for a session (call on logout/session delete).
 */
export async function clearPostgresAuthState(
  prisma: PrismaClient,
  sessionId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.waAuthKey.deleteMany({ where: { sessionId } }),
    prisma.waSession.update({
      where: { id: sessionId },
      data: { authState: Prisma.JsonNull },
    }),
  ]);
}
