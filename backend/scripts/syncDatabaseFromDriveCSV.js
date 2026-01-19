import dotenv from 'dotenv';
import googleDriveService from '../services/googleDriveService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import { importMeatCutsFromCSV } from '../utils/csvImporter.js';
import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';
import csv from 'csv-parser';
import { Readable } from 'stream';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse CSV content string into array of objects
 */
function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve(rows);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Update database with Google Drive image IDs from CSV
 */
async function syncDatabaseFromDriveCSV() {
  console.log('=== Sync Database from Google Drive CSV ===\n');

  try {
    // Initialize Google Drive service
    console.log('Initializing Google Drive service...');
    await googleDriveService.initialize();
    console.log('✓ Service initialized\n');

    // Step 1: Get CSV files from Google Drive
    console.log('--- Step 1: Finding CSV files in Google Drive ---');
    const csvFiles = await googleDriveService.listCSVFiles();
    
    if (csvFiles.length === 0) {
      console.error('❌ No CSV files found in Google Drive CSV folder');
      return;
    }
    
    // Use the most recent CSV file
    const csvFile = csvFiles[0];
    console.log(`✓ Found CSV file: ${csvFile.name} (ID: ${csvFile.id})\n`);

    // Step 2: Download CSV content
    console.log('--- Step 2: Downloading CSV content ---');
    const csvContent = await googleDriveService.downloadCSV(csvFile.id);
    console.log(`✓ CSV downloaded (${csvContent.length} characters)\n`);

    // Step 3: Save CSV locally temporarily
    const tempCsvPath = join(__dirname, '../../data/beefcut_init_database_temp.csv');
    writeFileSync(tempCsvPath, csvContent, 'utf-8');
    console.log(`✓ CSV saved to: ${tempCsvPath}\n`);

    // Step 4: Parse CSV
    console.log('--- Step 4: Parsing CSV ---');
    const rows = await parseCSV(csvContent);
    console.log(`✓ Parsed ${rows.length} rows\n`);

    // Step 5: Update database with Google Drive image IDs
    console.log('--- Step 5: Updating database with Google Drive image IDs ---');
    const db = getDatabase();
    let updatedCount = 0;
    let notFoundCount = 0;
    let alreadyUpToDateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row['Name'] || row['name'] || '';
      const imageReference = row['image reference'] || row['imageReference'] || row['image_reference'] || '';
      const googleDriveImageId = row['Google Drive Image ID'] || row['google_drive_image_id'] || row['googleDriveImageId'] || '';
      const googleDriveImageUrl = row['Google Drive Image URL'] || row['google_drive_image_url'] || row['googleDriveImageUrl'] || '';

      if (!googleDriveImageId) {
        continue; // Skip rows without Google Drive image ID
      }

      // Find meat cut by name or image reference
      let meatCut = null;
      if (imageReference) {
        meatCut = db.prepare('SELECT id, google_drive_image_id FROM meat_cuts WHERE image_reference = ?').get(imageReference);
      }
      
      if (!meatCut && name) {
        meatCut = db.prepare('SELECT id, google_drive_image_id FROM meat_cuts WHERE name = ?').get(name);
      }

      if (!meatCut) {
        notFoundCount++;
        console.log(`  ⚠ Row ${i + 2}: No meat cut found for "${name}" (imageReference: "${imageReference}")`);
        continue;
      }

      // Check if already up to date
      if (meatCut.google_drive_image_id === googleDriveImageId) {
        alreadyUpToDateCount++;
        continue;
      }

      // Update database
      const imageUrl = googleDriveImageUrl || googleDriveService.getImageUrl(googleDriveImageId);
      
      db.prepare(`
        UPDATE meat_cuts 
        SET google_drive_image_id = ?,
            google_drive_image_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(googleDriveImageId, imageUrl, meatCut.id);

      updatedCount++;
      console.log(`  ✓ Updated: "${name}" (ID: ${meatCut.id}) -> Image ID: ${googleDriveImageId}`);
    }

    console.log(`\n✓ Update complete:`);
    console.log(`  - Updated: ${updatedCount}`);
    console.log(`  - Already up to date: ${alreadyUpToDateCount}`);
    console.log(`  - Not found: ${notFoundCount}\n`);

    // Step 6: Update metadata
    db.prepare(`
      UPDATE metadata 
      SET value = datetime('now'), updated_at = datetime('now')
      WHERE key = 'last_meat_cuts_update'
    `).run();

    // Summary
    console.log('==========================================');
    console.log('Summary');
    console.log('==========================================');
    console.log(`Total rows processed: ${rows.length}`);
    console.log(`Database records updated: ${updatedCount}`);
    console.log(`Already up to date: ${alreadyUpToDateCount}`);
    console.log(`Not found in database: ${notFoundCount}`);
    console.log('==========================================');

  } catch (error) {
    console.error('Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
syncDatabaseFromDriveCSV().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
