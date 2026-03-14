import type { ImageStorage } from './image-storage.js';

/**
 * Cloudflare R2 storage for AI-generated promo images.
 *
 * Uses S3-compatible API via Cloudflare R2.
 * Storage path: {tenant_id}/generated/{promo_id}/{timestamp}.png
 */
export class R2ImageStorage implements ImageStorage {
  private readonly accountId: string;
  private readonly bucket: string;
  private readonly accessToken: string;
  private readonly publicBaseUrl: string;

  constructor(config: {
    accountId: string;
    bucket: string;
    accessToken: string;
    publicBaseUrl?: string;
  }) {
    this.accountId = config.accountId;
    this.bucket = config.bucket;
    this.accessToken = config.accessToken;
    this.publicBaseUrl = config.publicBaseUrl
      ?? `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  async upload(tenantId: string, promoId: string, imageUrl: string): Promise<string> {
    let buffer: ArrayBuffer;
    let contentType: string;
    let ext: string;

    if (imageUrl.startsWith('data:')) {
      // Handle data URI from ImageGenerator (base64-encoded)
      const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) throw new Error('Invalid data URI format');
      contentType = match[1]!;
      ext = contentType.split('/')[1] ?? 'png';
      const raw = atob(match[2]!);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      buffer = bytes.buffer;
    } else {
      // Handle regular URL (marketplace images)
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      buffer = await response.arrayBuffer();
      contentType = response.headers.get('content-type') ?? 'image/jpeg';
      ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg';
    }

    const timestamp = Date.now();
    const storagePath = `${tenantId}/generated/${promoId}/${timestamp}.${ext}`;

    // Upload via Cloudflare R2 API (S3-compatible PUT)
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucket}/objects/${storagePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorBody}`);
    }

    return this.getPublicUrl(storagePath);
  }

  async uploadBuffer(tenantId: string, promoId: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
    const ext = contentType.split('/')[1] ?? 'png';
    const timestamp = Date.now();
    const storagePath = `${tenantId}/generated/${promoId}/${timestamp}.${ext}`;

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucket}/objects/${storagePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorBody}`);
    }

    return this.getPublicUrl(storagePath);
  }

  getPublicUrl(path: string): string {
    return `${this.publicBaseUrl}/${path}`;
  }
}
