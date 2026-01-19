import dotenv from 'dotenv';
import googleDriveService from '../services/googleDriveService.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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
 * Convert array of objects back to CSV string
 */
function arrayToCSV(rows) {
  if (rows.length === 0) return '';
  
  // Get headers from first row
  const headers = Object.keys(rows[0]);
  
  // Create CSV header
  const csvRows = [headers.map(h => `"${h}"`).join(',')];
  
  // Add data rows
  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Normalize name for matching (lowercase, remove spaces, remove file extensions)
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .trim();
}

/**
 * Match image name to meat cut
 * Tries multiple matching strategies:
 * 1. Exact match on imageReference
 * 2. Partial match on name
 * 3. Match on imageReference without extension
 */
function matchImageToMeatCut(imageName, meatCut) {
  const normalizedImageName = normalizeName(imageName);
  const imageRef = normalizeName(meatCut['image reference'] || meatCut['imageReference'] || meatCut['image_reference'] || '');
  const meatCutName = normalizeName(meatCut['Name'] || meatCut['name'] || '');
  
  // Strategy 1: Exact match with imageReference
  if (imageRef && normalizedImageName === imageRef) {
    return true;
  }
  
  // Strategy 2: Image name contains imageReference
  if (imageRef && normalizedImageName.includes(imageRef)) {
    return true;
  }
  
  // Strategy 3: ImageReference contains image name (without extension)
  if (imageRef && imageRef.includes(normalizedImageName)) {
    return true;
  }
  
  // Strategy 4: Match on meat cut name
  if (meatCutName && normalizedImageName.includes(meatCutName)) {
    return true;
  }
  
  // Strategy 5: Meat cut name contains image name
  if (meatCutName && meatCutName.includes(normalizedImageName)) {
    return true;
  }
  
  return false;
}

/**
 * Fill googleDriveImageId in CSV by matching images from Google Drive
 */
async function fillGoogleDriveImageIds() {
  console.log('=== Fill Google Drive Image IDs in CSV ===\n');

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
    
    // Use the most recent CSV file (they're sorted by modifiedTime desc)
    const csvFile = csvFiles[0];
    console.log(`✓ Found CSV file: ${csvFile.name} (ID: ${csvFile.id})\n`);

    // Step 2: Download CSV content
    console.log('--- Step 2: Downloading CSV content ---');
    const csvContent = await googleDriveService.downloadCSV(csvFile.id);
    console.log(`✓ CSV downloaded (${csvContent.length} characters)\n`);

    // Step 3: Parse CSV
    console.log('--- Step 3: Parsing CSV ---');
    const rows = await parseCSV(csvContent);
    console.log(`✓ Parsed ${rows.length} rows\n`);

    // Step 4: Get all images from Google Drive Images folder
    console.log('--- Step 4: Getting images from Google Drive Images folder ---');
    const imageFiles = await googleDriveService.listFiles();
    const images = imageFiles.filter(file => 
      file.mimeType && file.mimeType.startsWith('image/')
    );
    console.log(`✓ Found ${images.length} images in Google Drive\n`);

    // Step 5: Create image lookup map
    console.log('--- Step 5: Creating image lookup map ---');
    const imageMap = new Map();
    for (const image of images) {
      const normalizedName = normalizeName(image.name);
      // Store by normalized name, keeping the file ID
      if (!imageMap.has(normalizedName)) {
        imageMap.set(normalizedName, image);
      }
    }
    console.log(`✓ Created lookup map with ${imageMap.size} unique image names\n`);

    // Step 6: Match images to meat cuts and update CSV
    console.log('--- Step 6: Matching images to meat cuts ---');
    let matchedCount = 0;
    let alreadyHasIdCount = 0;
    let unmatchedCount = 0;
    const unmatchedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Skip if already has googleDriveImageId
      if (row['google_drive_image_id'] || row['googleDriveImageId']) {
        alreadyHasIdCount++;
        continue;
      }

      let matched = false;
      
      // Try to find matching image
      for (const [normalizedImageName, image] of imageMap.entries()) {
        if (matchImageToMeatCut(image.name, row)) {
          // Found a match!
          row['google_drive_image_id'] = image.id;
          row['googleDriveImageId'] = image.id;
          row['google_drive_image_url'] = googleDriveService.getImageUrl(image.id);
          row['googleDriveImageUrl'] = googleDriveService.getImageUrl(image.id);
          matchedCount++;
          matched = true;
          console.log(`  ✓ Row ${i + 2}: "${row['Name'] || row['name'] || 'Unknown'}" -> Image: "${image.name}" (ID: ${image.id})`);
          break;
        }
      }
      
      if (!matched) {
        unmatchedCount++;
        unmatchedRows.push({
          row: i + 2,
          name: row['Name'] || row['name'] || 'Unknown',
          imageReference: row['image reference'] || row['imageReference'] || row['image_reference'] || 'N/A'
        });
      }
    }

    console.log(`\n✓ Matching complete:`);
    console.log(`  - Matched: ${matchedCount}`);
    console.log(`  - Already had ID: ${alreadyHasIdCount}`);
    console.log(`  - Unmatched: ${unmatchedCount}\n`);

    if (unmatchedRows.length > 0) {
      console.log('Unmatched rows:');
      unmatchedRows.slice(0, 10).forEach(item => {
        console.log(`  Row ${item.row}: "${item.name}" (imageReference: "${item.imageReference}")`);
      });
      if (unmatchedRows.length > 10) {
        console.log(`  ... and ${unmatchedRows.length - 10} more`);
      }
      console.log('');
    }

    // Step 7: Convert back to CSV
    console.log('--- Step 7: Converting updated data back to CSV ---');
    const updatedCSV = arrayToCSV(rows);
    console.log(`✓ CSV updated (${updatedCSV.length} characters)\n`);

    // Step 8: Upload updated CSV back to Google Drive
    console.log('--- Step 8: Uploading updated CSV to Google Drive ---');
    const uploadResult = await googleDriveService.uploadCSV(updatedCSV, csvFile.name);
    console.log(`✓ CSV uploaded successfully!`);
    console.log(`  File ID: ${uploadResult.fileId}`);
    console.log(`  File Name: ${uploadResult.fileName}\n`);

    // Summary
    console.log('==========================================');
    console.log('Summary');
    console.log('==========================================');
    console.log(`Total rows processed: ${rows.length}`);
    console.log(`Images matched: ${matchedCount}`);
    console.log(`Already had ID: ${alreadyHasIdCount}`);
    console.log(`Unmatched: ${unmatchedCount}`);
    console.log(`Updated CSV uploaded: ${uploadResult.fileName}`);
    console.log('==========================================');

  } catch (error) {
    console.error('Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
fillGoogleDriveImageIds().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
