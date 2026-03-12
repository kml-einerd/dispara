/**
 * Interface for storing and serving promo images.
 * V1 uses Supabase Storage as the backend.
 */
export interface ImageStorage {
  /**
   * Downloads an image from a URL and uploads it to storage.
   * @param tenantId - Tenant UUID for path scoping
   * @param promoId - Promo UUID for organizing images
   * @param imageUrl - Source image URL to download
   * @returns Public URL of the stored image
   */
  upload(tenantId: string, promoId: string, imageUrl: string): Promise<string>;

  /**
   * Gets the public URL for a stored image path.
   * @param path - Storage path (e.g. "tenant-uuid/promos/promo-uuid/image.jpg")
   * @returns Full public URL
   */
  getPublicUrl(path: string): string;
}

/**
 * Supabase Storage implementation for promo images.
 *
 * Storage path pattern: {tenant_id}/promos/{promo_id}/{filename}
 * Bucket: "promo-images" (must be created in Supabase dashboard)
 */
export class SupabaseImageStorage implements ImageStorage {
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;
  private readonly bucket: string;

  /**
   * @param supabaseUrl - Supabase project URL
   * @param supabaseServiceKey - Supabase service role key (for server-side uploads)
   * @param bucket - Storage bucket name (default: "promo-images")
   */
  constructor(supabaseUrl: string, supabaseServiceKey: string, bucket: string = 'promo-images') {
    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceKey = supabaseServiceKey;
    this.bucket = bucket;
  }

  /**
   * Downloads image from marketplace URL and uploads to Supabase Storage.
   * Extracts filename from URL, downloads the image, and stores it
   * under the tenant/promo path hierarchy.
   *
   * @param tenantId - Tenant UUID
   * @param promoId - Promo UUID
   * @param imageUrl - Source image URL from marketplace
   * @returns Public URL of the uploaded image
   */
  async upload(tenantId: string, promoId: string, imageUrl: string): Promise<string> {
    // Extract filename from URL or generate one
    const urlParts = new URL(imageUrl);
    const pathParts = urlParts.pathname.split('/');
    const originalFilename = pathParts[pathParts.length - 1] || 'image.jpg';
    const extension = originalFilename.split('.').pop() || 'jpg';
    const filename = `product.${extension}`;

    // Storage path: {tenant_id}/promos/{promo_id}/{filename}
    const storagePath = `${tenantId}/promos/${promoId}/${filename}`;

    try {
      // Download image from source URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || `image/${extension}`;

      // Upload to Supabase Storage
      const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storagePath}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseServiceKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true', // overwrite if exists
        },
        body: imageBuffer,
      });

      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.text();
        throw new Error(`Supabase upload failed: ${uploadResponse.status} - ${errorBody}`);
      }

      return this.getPublicUrl(storagePath);
    } catch (error) {
      // If upload fails, return the original marketplace URL as fallback
      console.error(`[SupabaseImageStorage] Upload failed for ${imageUrl}:`, error);
      return imageUrl;
    }
  }

  /**
   * Constructs the public URL for an image stored in Supabase Storage.
   *
   * @param path - Storage path within the bucket
   * @returns Full public URL
   */
  getPublicUrl(path: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${path}`;
  }
}
