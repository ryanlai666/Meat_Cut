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
 * Get or create a folder in Google Drive
 * @param {object} drive - Google Drive API client
 * @param {string} folderName - Name of the folder
 * @param {string} parentFolderId - Optional parent folder ID
 * @param {string} envFolderId - Optional folder ID from environment variable
 * @returns {Promise<string>} - Folder ID
 */
export async function getOrCreateFolder(drive, folderName, parentFolderId = null, envFolderId = null) {
  // If folder ID is provided in env, use it
  if (envFolderId) {
    try {
      console.log(`Verifying folder ID: ${envFolderId}`);
      const response = await drive.files.get({
        fileId: envFolderId,
        fields: 'id, name',
        supportsAllDrives: true
      });
      console.log(`✓ Using folder: ${response.data.name} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error(`Error accessing folder ID ${envFolderId}:`, error.message);
      throw new Error(`Failed to access the specified Google Drive folder: ${error.message}`);
    }
  }
  
  // Build search query
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }
  
  // Search for existing folder
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (response.data.files && response.data.files.length > 0) {
      console.log(`✓ Found existing folder: ${folderName} (ID: ${response.data.files[0].id})`);
      return response.data.files[0].id;
    }
  } catch (error) {
    console.warn('Error searching for folder:', error.message);
  }
  
  // Create new folder if not found
  try {
    const requestBody = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentFolderId) {
      requestBody.parents = [parentFolderId];
    }
    
    const response = await drive.files.create({
      requestBody: requestBody,
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

/**
 * Get or create the Google Drive folder for meat cut images
 * @param {object} drive - Google Drive API client
 * @returns {Promise<string>} - Folder ID
 */
export async function getOrCreateImageFolder(drive) {
  const imagesFolderName = process.env.GOOGLE_DRIVE_IMAGES_FOLDER_NAME || 'Images';
  const baseFolderName = process.env.GOOGLE_DRIVE_BASE_FOLDER_NAME || 'meat-cut-app';
  const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
  
  // High priority for the specific folder ID you provided
  const imagesFolderId = process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID || 
                        process.env.IMAGES_FOLDER ||
                        process.env.GOOGLE_DRIVE_FOLDER_ID ||
                        '1Vim-Q-65__G-1Fi0x23vk6Tm8EkfjnQN';
  
  // If a specific images folder ID is provided, use it directly
  if (imagesFolderId && imagesFolderId !== 'root') {
    return await getOrCreateFolder(drive, imagesFolderName, null, imagesFolderId);
  }

  // Otherwise, use the base folder structure
  const parentId = await getOrCreateFolder(drive, baseFolderName, null, baseFolderId);
  return await getOrCreateFolder(drive, imagesFolderName, parentId);
}

/**
 * Get or create the CSV folder in Google Drive
 * @param {object} drive - Google Drive API client
 * @returns {Promise<string>} - Folder ID
 */
export async function getOrCreateCSVFolder(drive) {
  const csvFolderName = process.env.GOOGLE_DRIVE_CSV_FOLDER_NAME || 'CSV';
  const baseFolderName = process.env.GOOGLE_DRIVE_BASE_FOLDER_NAME || 'meat-cut-app';
  const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
  
  // High priority for the specific folder ID you provided
  const csvFolderId = process.env.GOOGLE_DRIVE_CSV_FOLDER_ID || 
                     process.env.DRIVE_CSV_FOLDER;
  
  // If a specific CSV folder ID is provided, use it directly
  if (csvFolderId && csvFolderId !== 'root') {
    return await getOrCreateFolder(drive, csvFolderName, null, csvFolderId);
  }

  // Otherwise, use the base folder structure
  const parentId = await getOrCreateFolder(drive, baseFolderName, null, baseFolderId);
  return await getOrCreateFolder(drive, csvFolderName, parentId);
}

export default { 
  initializeDriveClient, 
  getOrCreateImageFolder,
  getOrCreateCSVFolder,
  getOrCreateFolder
};
