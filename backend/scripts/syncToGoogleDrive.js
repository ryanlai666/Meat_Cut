import dotenv from 'dotenv';
import googleDriveService from '../services/googleDriveService.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import getDatabase from '../config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sync all local assets (images and CSV) to Google Drive
 */
async function syncToGoogleDrive() {
  console.log('=== Sync Assets to Google Drive ===\n');

  try {
    // Initialize Google Drive service
    console.log('Initializing Google Drive service...');
    await googleDriveService.initialize();
    console.log('✓ Service initialized\n');

    const db = getDatabase();

    // 1. Upload CSV File
    console.log('--- Step 1: Uploading CSV ---');
    const csvPath = join(__dirname, '../../data/beefcut_init_database.csv');
    if (existsSync(csvPath)) {
      console.log(`Uploading CSV: ${csvPath}`);
      const csvData = readFileSync(csvPath);
      const csvResult = await googleDriveService.uploadCSV(csvData, 'beefcut_init_database.csv');
      console.log(`✓ CSV uploaded. File ID: ${csvResult.fileId}\n`);
    } else {
      console.warn('⚠ CSV file not found at', csvPath, '\n');
    }

    // 2. Upload Title Image
    console.log('--- Step 2: Uploading Title Image ---');
    const titleImagePath = join(__dirname, '../../data/beef_cuts_title.jpg');
    if (existsSync(titleImagePath)) {
      console.log(`Uploading Title Image: ${titleImagePath}`);
      const titleImageData = readFileSync(titleImagePath);
      const titleResult = await googleDriveService.uploadImage(titleImageData, 'beef_cuts_title.jpg', 'image/jpeg');
      console.log(`✓ Title image uploaded. File ID: ${titleResult.fileId}\n`);
    } else {
      console.warn('⚠ Title image not found at', titleImagePath, '\n');
    }

    // 3. Upload All Meat Cut Images
    console.log('--- Step 3: Uploading Meat Cut Images ---');
    const imagesDir = join(__dirname, '../../data/beef_cuts_images');
    
    if (!existsSync(imagesDir)) {
      console.error('❌ Images directory not found:', imagesDir);
      return;
    }

    const imageFiles = readdirSync(imagesDir).filter(file => {
      const ext = extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    console.log(`Found ${imageFiles.length} image files to process\n`);

    let uploadedCount = 0;
    let updatedDbCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const imageFile of imageFiles) {
      try {
        const imagePath = join(imagesDir, imageFile);
        const imageReference = basename(imageFile, extname(imageFile));
        
        console.log(`Processing: ${imageFile} (${imageReference})`);

        // Read image file
        const imageBuffer = readFileSync(imagePath);
        
        // Upload to Google Drive
        // Note: We'll upload even if it's already in DB, but we could check first to save time
        // However, the user asked to "upload all existing images files" to ensure single source.
        
        const uploadResult = await googleDriveService.uploadImage(
          imageBuffer,
          imageFile,
          'image/jpeg'
        );

        uploadedCount++;

        // Update database if an entry exists for this image reference
        const meatCut = db.prepare(
          'SELECT id FROM meat_cuts WHERE image_reference = ?'
        ).get(imageReference);

        if (meatCut) {
          db.prepare(`
            UPDATE meat_cuts 
            SET google_drive_image_id = ?, 
                google_drive_image_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            uploadResult.fileId,
            uploadResult.imageUrl,
            meatCut.id
          );
          console.log(`  ✓ Database updated for meat cut: ${imageReference}`);
          updatedDbCount++;
        } else {
          console.log(`  ✓ Uploaded but no matching meat cut found in database for: ${imageReference}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Error processing ${imageFile}:`, error.message);
        errorCount++;
      }
    }

    // Update metadata
    db.prepare(`
      UPDATE metadata 
      SET value = datetime('now'), updated_at = CURRENT_TIMESTAMP 
      WHERE key = 'last_meat_cuts_update'
    `).run();

    // Summary
    console.log('\n==========================================');
    console.log('Sync Summary');
    console.log('==========================================');
    console.log(`CSV Uploaded: ${existsSync(csvPath) ? 'Yes' : 'No'}`);
    console.log(`Title Image Uploaded: ${existsSync(titleImagePath) ? 'Yes' : 'No'}`);
    console.log(`Total images processed: ${imageFiles.length}`);
    console.log(`Images uploaded to Drive: ${uploadedCount}`);
    console.log(`Database records updated: ${updatedDbCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('==========================================');

  } catch (error) {
    console.error('Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run sync
syncToGoogleDrive().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
