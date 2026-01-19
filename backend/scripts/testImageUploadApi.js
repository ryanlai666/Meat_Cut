// import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:5000/api';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ''; // Use the key from .env if available

async function testImageUpload() {
  console.log('=== Testing Image Upload via API ===\n');

  // Images to test
  const imagesToTest = [
    'beef_cut_r1_c1.jpg',
    'beef_cut_r1_c2.jpg',
    'beef_cut_r1_c3.jpg'
  ];

  const imagesDir = path.join(__dirname, '../../data/beef_cuts_images');

  for (const imageName of imagesToTest) {
    const imagePath = path.join(imagesDir, imageName);
    
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image not found: ${imagePath}`);
      continue;
    }

    console.log(`Processing ${imageName}...`);

    try {
      // Read image and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Prepare meat cut data
      const name = `Test Cut ${path.basename(imageName, '.jpg')} ${Date.now()}`;
      const meatCutData = {
        name: name,
        chineseName: `測試肉品 ${imageName}`,
        part: 'Test Part',
        lean: true,
        priceMin: 10,
        priceMax: 20,
        imageReference: path.basename(imageName, '.jpg'),
        imageFile: base64Image
      };

      console.log(`  Sending request to create meat cut with image...`);
      
      const response = await fetch(`${API_BASE_URL}/admin/meat-cuts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ADMIN_API_KEY
        },
        body: JSON.stringify(meatCutData)
      });

      const result = await response.json();

      if (response.status === 201) {
        console.log(`  ✅ Successfully created meat cut: ${result.name}`);
        console.log(`  ✅ Image URL: ${result.imageUrl}`);
        console.log(`  ✅ Google Drive ID: ${result.googleDriveImageId}`);
      } else {
        console.log(`  ❌ Failed with status ${response.status}:`, result);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
    console.log('');
  }
}

testImageUpload();
