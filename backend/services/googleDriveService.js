import { initializeDriveClient, getOrCreateImageFolder } from '../config/googleDrive.js';
import { Readable } from 'stream';

/**
 * Google Drive Service
 * Handles all Google Drive operations for meat cut images
 */
class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.folderId = null;
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const { drive } = initializeDriveClient();
      this.drive = drive;
      this.folderId = await getOrCreateImageFolder(drive);
      this.initialized = true;
      console.log('Google Drive service initialized');
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Upload an image to Google Drive
   * @param {Buffer|string} imageData - Image data (Buffer or base64 string)
   * @param {string} fileName - Name for the file
   * @param {string} mimeType - MIME type (default: 'image/jpeg')
   * @param {string} folderId - Optional target folder ID
   * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
   */
  async uploadImage(imageData, fileName, mimeType = 'image/jpeg', folderId = null) {
    await this.ensureInitialized();

    const finalFolderId = folderId || this.folderId;

    try {
      // Convert base64 to buffer if needed
      let buffer;
      if (typeof imageData === 'string') {
        // Remove data URL prefix if present
        const base64Data = imageData.includes(',') 
          ? imageData.split(',')[1] 
          : imageData;
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }

      // Upload file
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [finalFolderId],
        },
        media: {
          mimeType: mimeType,
          body: Readable.from(buffer)
        },
        fields: 'id, name, webViewLink, webContentLink',
        supportsAllDrives: true,
        supportsTeamDrives: true, // Legacy support
      });

      const fileId = response.data.id;

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        },
        supportsAllDrives: true,
      });

      // Generate direct image URL
      const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      return {
        fileId: fileId,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        imageUrl: imageUrl
      };
    } catch (error) {
      console.error('Error uploading image to Google Drive:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Update an existing image in Google Drive
   * @param {string} fileId - Google Drive file ID
   * @param {Buffer|string} imageData - New image data
   * @param {string} mimeType - MIME type (default: 'image/jpeg')
   * @returns {Promise<{fileId: string, imageUrl: string}>}
   */
  async updateImage(fileId, imageData, mimeType = 'image/jpeg') {
    await this.ensureInitialized();

    try {
      // Convert base64 to buffer if needed
      let buffer;
      if (typeof imageData === 'string') {
        const base64Data = imageData.includes(',') 
          ? imageData.split(',')[1] 
          : imageData;
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }

      // Update file
      await this.drive.files.update({
        fileId: fileId,
        media: {
          mimeType: mimeType,
          body: Readable.from(buffer)
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      return {
        fileId: fileId,
        imageUrl: imageUrl
      };
    } catch (error) {
      console.error('Error updating image in Google Drive:', error);
      throw new Error(`Failed to update image: ${error.message}`);
    }
  }

  /**
   * Delete an image from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<boolean>}
   */
  async deleteImage(fileId) {
    await this.ensureInitialized();

    if (!fileId) {
      console.warn('No file ID provided for deletion');
      return false;
    }

    try {
      await this.drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true,
      });

      return true;
    } catch (error) {
      // If file not found, consider it already deleted
      if (error.code === 404) {
        console.warn(`File ${fileId} not found, considering it deleted`);
        return true;
      }
      console.error('Error deleting image from Google Drive:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Get image URL from file ID
   * @param {string} fileId - Google Drive file ID
   * @returns {string} - Direct image URL
   */
  getImageUrl(fileId) {
    if (!fileId) {
      return null;
    }
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  /**
   * Download an image from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<Buffer>}
   */
  async downloadImage(fileId) {
    await this.ensureInitialized();

    try {
      const response = await this.drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image from Google Drive:', error);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * List all files in the image folder
   * @returns {Promise<Array>}
   */
  async listFiles() {
    await this.ensureInitialized();

    try {
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files from Google Drive:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get folder ID
   * @returns {string}
   */
  getFolderId() {
    return this.folderId;
  }
}

// Export singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService;
