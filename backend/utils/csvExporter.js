import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';

/**
 * Export all meat cuts to CSV format
 * @returns {string} - CSV content as string
 */
export function exportMeatCutsToCSV() {
  const db = getDatabase();
  const meatCuts = MeatCut.findAll();
  
  // CSV headers
  const headers = [
    'ID',
    'Name',
    'Chinese Name',
    'Part',
    'Lean',
    'Price Min',
    'Price Max',
    'Price Mean',
    'Price Display',
    'Texture & Notes',
    'image reference',
    'Rec. Cooking Methods',
    'Recommended Dishes',
    'Google Drive Image ID',
    'Google Drive Image URL',
    'Slug'
  ];

  // Helper function to escape CSV values
  function escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Build CSV rows
  const rows = meatCuts.map(mc => {
    const cookingMethods = MeatCut.getCookingMethods(mc.id).join(', ');
    const recommendedDishes = MeatCut.getRecommendedDishes(mc.id).join(', ');
    
    return [
      mc.id,
      mc.name,
      mc.chineseName || '',
      mc.part || '',
      mc.lean ? 'Yes' : 'No',
      mc.priceRange.min,
      mc.priceRange.max,
      mc.priceRange.mean,
      mc.priceRange.display,
      mc.textureNotes || '',
      mc.imageReference || '',
      cookingMethods,
      recommendedDishes,
      mc.googleDriveImageId || '',
      mc.googleDriveImageUrl || '',
      mc.slug || ''
    ].map(escapeCSV).join(',');
  });

  // Combine headers and rows
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows
  ].join('\n');

  return csvContent;
}

/**
 * Export meat cuts to CSV with filename including timestamp
 * @returns {object} - { content: string, filename: string }
 */
export function exportMeatCutsToCSVWithFilename() {
  const content = exportMeatCutsToCSV();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `meat_cuts_export_${timestamp}.csv`;
  
  return {
    content,
    filename
  };
}

export default { exportMeatCutsToCSV, exportMeatCutsToCSVWithFilename };
