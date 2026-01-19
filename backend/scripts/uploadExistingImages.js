import dotenv from 'dotenv';
import googleDriveService from '../services/googleDriveService.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import getDatabase from '../config/database.js';
import { MeatCut } from '../models/MeatCut.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Upload existing images to Google Drive and update database
 */
async function uploadExistingImages() {
  console.log('=== Upload Existing Images to Google Drive ===\n');

  try {
    // Initialize Google Drive service
    console.log('Initializing Google Drive service...');
    await googleDriveService.initialize();
    console.log('✓ Service initialized\n');

    // Get images directory
    const imagesDir = join(__dirname, '../../data/beef_cuts_images');
    
    // Get all image files
    const imageFiles = readdirSync(imagesDir).filter(file => {
      const ext = extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    console.log(`Found ${imageFiles.length} image files to upload\n`);

    // Get database
    const db = getDatabase();

    let uploaded = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Process each image
    for (const imageFile of imageFiles) {
      try {
        const imagePath = join(imagesDir, imageFile);
        const imageReference = basename(imageFile, extname(imageFile)); // e.g., "beef_cut_r1_c1"
        
        console.log(`Processing: ${imageFile} (${imageReference})`);

        // Check if meat cut with this image_reference exists
        const meatCut = db.prepare(
          'SELECT id, google_drive_image_id, name FROM meat_cuts WHERE image_reference = ?'
        ).get(imageReference);

        if (!meatCut) {
          console.log(`  ⚠ No meat cut found with image_reference: ${imageReference}`);
          skipped++;
          continue;
        }

        // If already uploaded, skip
        if (meatCut.google_drive_image_id) {
          console.log(`  ⏭ Already uploaded (File ID: ${meatCut.google_drive_image_id})`);
          skipped++;
          continue;
        }

        // Read image file
        const imageBuffer = readFileSync(imagePath);
        
        // Upload to Google Drive
        const uploadResult = await googleDriveService.uploadImage(
          imageBuffer,
          imageFile,
          'image/jpeg'
        );

        // Update database
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

        console.log(`  ✓ Uploaded successfully`);
        console.log(`    File ID: ${uploadResult.fileId}`);
        console.log(`    URL: ${uploadResult.imageUrl}`);
        
        if (meatCut.google_drive_image_id) {
          updated++;
        } else {
          uploaded++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Error processing ${imageFile}:`, error.message);
        errors++;
      }
      console.log('');
    }

    // Update metadata
    db.prepare(`
      UPDATE metadata 
      SET value = datetime('now'), updated_at = CURRENT_TIMESTAMP 
      WHERE key = 'last_meat_cuts_update'
    `).run();

    // Summary
    console.log('==========================================');
    console.log('Upload Summary');
    console.log('==========================================');
    console.log(`Total images: ${imageFiles.length}`);
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('==========================================');

    if (errors > 0) {
      console.warn(`\n⚠ Warning: ${errors} errors occurred during upload`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run upload
uploadExistingImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
