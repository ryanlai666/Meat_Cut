import Papa from 'papaparse';
import { MeatCut } from '../types';

function parsePriceRange(priceStr: string): { min: number; max: number; mean: number; display: string } {
  // Extract price range like "$6 – $9" or "$6 - $9"
  const match = priceStr.match(/\$(\d+)\s*[–-]\s*\$(\d+)/);
  if (match) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    return {
      min,
      max,
      mean: (min + max) / 2,
      display: priceStr
    };
  }
  // Fallback if format is unexpected
  return { min: 0, max: 0, mean: 0, display: priceStr };
}

export async function loadMeatCutData(): Promise<MeatCut[]> {
  try {
    const response = await fetch('/data/beefcut_init_database.csv');
    const text = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const meatCuts: MeatCut[] = (results.data as any[]).map((row: any, index: number) => {
              const priceRange = parsePriceRange(row['Approx. Price'] || '');
              const cookingMethods = (row['Rec. Cooking Methods'] || '')
                .split(',')
                .map((m: string) => m.trim())
                .filter((m: string) => m.length > 0);
              
              const imageRef = (row['image reference'] || '').trim();
              
              return {
                id: parseInt(row.ID || index + 1, 10),
                name: row.Name || '',
                chineseName: row['Chinese Name'] || '',
                part: row.Part || '',
                lean: row.Lean === 'Yes',
                priceRange,
                cookingMethods,
                recommendedDishes: (row['Recommended Dishes'] || '')
                  .split(',')
                  .map((d: string) => d.trim())
                  .filter((d: string) => d.length > 0),
                textureNotes: row['Texture & Notes'] || '',
                imageReference: imageRef,
                imagePath: imageRef ? `/data/beef_cuts_images/${imageRef}.jpg` : ''
              };
            }).filter((cut: MeatCut) => cut.name.length > 0);
            
            resolve(meatCuts);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error loading CSV:', error);
    throw error;
  }
}
