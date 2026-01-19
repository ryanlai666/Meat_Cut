import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize Google Drive API client using service account
 * @returns {object} - Google Drive API client
 */
export function initializeDriveClient() {
  // Get credentials path from environment or use default
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
    join(__dirname, '../meat-buyer-guide-39a5081fce50-key.json');
  
  console.log(`Using Google credentials from: ${credentialsPath}`);
  
  try {
    // Check if file exists
    if (!readFileSync(credentialsPath)) {
       throw new Error(`Credentials file not found at ${credentialsPath}`);
    }

    // Create Google Auth client
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth });
    
    return { drive, auth };
  } catch (error) {
    console.error('Error initializing Google Drive client:', error.message);
    throw new Error(`Failed to initialize Google Drive: ${error.message}`);
  }
}

/**
 * Get or create the Google Drive folder for meat cut images
 * @param {object} drive - Google Drive API client
 * @returns {Promise<string>} - Folder ID
 */
export async function getOrCreateImageFolder(drive) {
  const folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'meat-cut-images';
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  // If folder ID is provided in env, use it
  if (folderId) {
    try {
      console.log(`Verifying folder ID from env: ${folderId}`);
      const response = await drive.files.get({
        fileId: folderId,
        fields: 'id, name',
        supportsAllDrives: true
      });
      console.log(`✓ Using folder: ${response.data.name} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error(`Error accessing folder ID ${folderId}:`, error.message);
      // Don't fall back to creating a new one if a specific ID was requested but failed
      throw new Error(`Failed to access the specified Google Drive folder: ${error.message}`);
    }
  }
  
  // Search for existing folder
  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }
  } catch (error) {
    console.warn('Error searching for folder:', error.message);
  }
  
  // Create new folder if not found
  try {
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    
    console.log(`Created Google Drive folder: ${folderName} (ID: ${response.data.id})`);
    return response.data.id;
  } catch (error) {
    console.error('Error creating folder:', error.message);
    throw new Error(`Failed to create Google Drive folder: ${error.message}`);
  }
}

export default { initializeDriveClient, getOrCreateImageFolder };
