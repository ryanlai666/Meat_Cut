import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';
import CookingMethod from '../models/CookingMethod.js';
import RecommendedDish from '../models/RecommendedDish.js';
import { parsePriceDisplay, normalizeLean } from './validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse cooking methods string (comma-separated)
 * @param {string} methodsStr - Cooking methods string
 * @returns {Array<string>} - Array of cooking method names
 */
function parseCookingMethods(methodsStr) {
  if (!methodsStr || typeof methodsStr !== 'string') {
    return [];
  }
  
  return methodsStr
    .split(',')
    .map(m => m.trim())
    .filter(m => m.length > 0);
}

/**
 * Parse recommended dishes string (comma-separated)
 * @param {string} dishesStr - Recommended dishes string
 * @returns {Array<string>} - Array of recommended dish names
 */
function parseRecommendedDishes(dishesStr) {
  if (!dishesStr || typeof dishesStr !== 'string') {
    return [];
  }
  
  return dishesStr
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0);
}

/**
 * Import meat cuts from CSV file
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<{success: boolean, imported: number, errors: Array}>}
 */
export function importMeatCutsFromCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const results = {
      success: true,
      imported: 0,
      errors: []
    };
    
    const rows = [];
    
    createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        // Process all rows
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            // Parse price display
            const priceDisplay = row['Approx. Price'] || row['Approx Price'] || '';
            const prices = parsePriceDisplay(priceDisplay);
            
            if (!prices) {
              results.errors.push({
                row: i + 2, // +2 because header is row 1, and we're 0-indexed
                error: `Invalid price format: ${priceDisplay}`
              });
              continue;
            }
            
            // Parse lean
            const lean = normalizeLean(row['Lean'] || row['lean']);
            
            // Create meat cut data
            const meatCutData = {
              name: row['Name'] || row['name'] || '',
              chineseName: row['Chinese Name'] || row['chineseName'] || '',
              part: row['Part'] || row['part'] || '',
              lean: lean,
              priceMin: prices.min,
              priceMax: prices.max,
              priceMean: prices.mean,
              priceDisplay: priceDisplay,
              textureNotes: row['Texture & Notes'] || row['textureNotes'] || null,
              imageReference: row['image reference'] || row['imageReference'] || row['image_reference'] || '',
              googleDriveImageId: row['Google Drive Image ID'] || row['google_drive_image_id'] || row['googleDriveImageId'] || null,
              googleDriveImageUrl: row['Google Drive Image URL'] || row['google_drive_image_url'] || row['googleDriveImageUrl'] || null
            };
            
            // Validate required fields
            if (!meatCutData.name || !meatCutData.chineseName || !meatCutData.part || !meatCutData.imageReference) {
              results.errors.push({
                row: i + 2,
                error: 'Missing required fields (name, chineseName, part, or imageReference)'
              });
              continue;
            }
            
            // Create meat cut
            const meatCut = MeatCut.create(meatCutData);
            
            // Parse and associate cooking methods
            const cookingMethodsStr = row['Rec. Cooking Methods'] || row['cookingMethods'] || '';
            const cookingMethods = parseCookingMethods(cookingMethodsStr);
            
            for (const methodName of cookingMethods) {
              const method = CookingMethod.findOrCreate(methodName);
              CookingMethod.associateWithMeatCut(meatCut.id, method.id);
            }
            
            // Parse and associate recommended dishes
            const dishesStr = row['Recommended Dishes'] || row['Recommended Dishes'] || row['recommendedDishes'] || '';
            const recommendedDishes = parseRecommendedDishes(dishesStr);
            
            for (const dishName of recommendedDishes) {
              const dish = RecommendedDish.findOrCreate(dishName);
              RecommendedDish.associateWithMeatCut(meatCut.id, dish.id);
            }
            
            results.imported++;
          } catch (error) {
            results.success = false;
            results.errors.push({
              row: i + 2,
              error: error.message || 'Unknown error',
              details: error.stack
            });
          }
        }
        
        // Update metadata
        const db = getDatabase();
        db.prepare(`
          UPDATE metadata 
          SET value = datetime('now'), updated_at = datetime('now')
          WHERE key = 'last_meat_cuts_update'
        `).run();
        
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Import meat cuts from default CSV location
 * @returns {Promise<{success: boolean, imported: number, errors: Array}>}
 */
export function importDefaultCSV() {
  // Default CSV path: data/beefcut_init_database.csv (relative to project root)
  const csvPath = join(__dirname, '../../data/beefcut_init_database.csv');
  return importMeatCutsFromCSV(csvPath);
}

export default { importMeatCutsFromCSV, importDefaultCSV };
