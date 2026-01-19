import dotenv from 'dotenv';
import googleDriveService from '../services/googleDriveService.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test script for Google Drive API functionality
 */
async function testGoogleDrive() {
  console.log('=== Google Drive API Test ===\n');

  try {
    // Test 1: Initialize service
    console.log('1. Testing service initialization...');
    await googleDriveService.initialize();
    console.log('✓ Service initialized successfully');
    console.log(`  Folder ID: ${googleDriveService.getFolderId()}\n`);

    // Test 2: List existing files
    console.log('2. Testing list files...');
    const files = await googleDriveService.listFiles();
    console.log(`✓ Found ${files.length} files in folder`);
    if (files.length > 0) {
      console.log('  Sample files:');
      files.slice(0, 5).forEach(file => {
        console.log(`    - ${file.name} (ID: ${file.id})`);
      });
    }
    console.log('');

    // Test 3: Upload a test image
    console.log('3. Testing image upload...');
    const testImagePath = join(__dirname, '../../data/beef_cuts_images/beef_cut_r1_c1.jpg');
    
    let testImageBuffer;
    try {
      testImageBuffer = readFileSync(testImagePath);
    } catch (error) {
      console.log('  ⚠ Test image not found, creating a dummy test...');
      // Create a minimal test image (1x1 red pixel in JPEG format)
      testImageBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
        'base64'
      );
    }

    const uploadResult = await googleDriveService.uploadImage(
      testImageBuffer,
      'test-image-' + Date.now() + '.jpg',
      'image/jpeg'
    );
    console.log('✓ Image uploaded successfully');
    console.log(`  File ID: ${uploadResult.fileId}`);
    console.log(`  Image URL: ${uploadResult.imageUrl}\n`);

    // Test 4: Get image URL
    console.log('4. Testing get image URL...');
    const imageUrl = googleDriveService.getImageUrl(uploadResult.fileId);
    console.log(`✓ Image URL: ${imageUrl}\n`);

    // Test 5: Download image
    console.log('5. Testing image download...');
    const downloadedBuffer = await googleDriveService.downloadImage(uploadResult.fileId);
    console.log(`✓ Image downloaded successfully (${downloadedBuffer.length} bytes)\n`);

    // Test 6: Update image
    console.log('6. Testing image update...');
    // Use the same buffer for update test
    const updateResult = await googleDriveService.updateImage(
      uploadResult.fileId,
      testImageBuffer,
      'image/jpeg'
    );
    console.log('✓ Image updated successfully');
    console.log(`  File ID: ${updateResult.fileId}`);
    console.log(`  Image URL: ${updateResult.imageUrl}\n`);

    // Test 7: Delete image
    console.log('7. Testing image deletion...');
    const deleted = await googleDriveService.deleteImage(uploadResult.fileId);
    if (deleted) {
      console.log('✓ Image deleted successfully\n');
    } else {
      console.log('⚠ Image deletion returned false\n');
    }

    // Test 8: Test delete non-existent file (should handle gracefully)
    console.log('8. Testing deletion of non-existent file...');
    const deletedNonExistent = await googleDriveService.deleteImage('non-existent-id-12345');
    console.log(`✓ Handled gracefully (result: ${deletedNonExistent})\n`);

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testGoogleDrive().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
