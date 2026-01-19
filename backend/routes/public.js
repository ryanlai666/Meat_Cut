import express from 'express';
import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';
import SearchService from '../services/searchService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/metadata
 * Get system metadata
 */
router.get('/metadata', asyncHandler(async (req, res) => {
  const db = getDatabase();
  
  // Get metadata
  const lastUpdate = db.prepare(`
    SELECT value FROM metadata WHERE key = 'last_meat_cuts_update'
  `).get();
  
  const version = db.prepare(`
    SELECT value FROM metadata WHERE key = 'app_version'
  `).get();
  
  // Get total meat cuts count
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM meat_cuts').get();

  res.json({
    lastUpdate: lastUpdate?.value || new Date().toISOString(),
    totalMeatCuts: totalCount.count || 0,
    version: version?.value || '1.0.0'
  });
}));

/**
 * GET /api/meat-cuts/search
 * Search meat cuts with filters
 */
router.get('/meat-cuts/search', asyncHandler(async (req, res) => {
  const {
    q,
    priceMin,
    priceMax,
    part,
    lean,
    cookingMethod
  } = req.query;

  // Parse query parameters
  const filters = {
    q: q || '',
    priceMin: priceMin ? parseFloat(priceMin) : undefined,
    priceMax: priceMax ? parseFloat(priceMax) : undefined,
    part: part || undefined,
    lean: lean !== undefined ? lean === 'true' || lean === '1' : undefined,
    cookingMethod: cookingMethod || undefined
  };

  const results = SearchService.search(filters);

  res.json(results);
}));

/**
 * GET /api/meat-cuts/:slug
 * Get single meat cut by slug
 */
router.get('/meat-cuts/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const meatCut = MeatCut.findBySlug(slug);
  
  if (!meatCut) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Meat cut not found'
      }
    });
  }

  // Get related data
  const cookingMethods = MeatCut.getCookingMethods(meatCut.id);
  const recommendedDishes = MeatCut.getRecommendedDishes(meatCut.id);

  // Build share URL (assuming frontend domain from env or default)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const shareUrl = `${frontendUrl}/meat/${slug}`;

  res.json({
    ...meatCut,
    cookingMethods,
    recommendedDishes,
    imageUrl: meatCut.googleDriveImageUrl || null,
    shareUrl
  });
}));

/**
 * GET /api/meat-cuts/:slug/image
 * Redirect to meat cut image
 */
router.get('/meat-cuts/:slug/image', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const meatCut = MeatCut.findBySlug(slug);
  
  if (!meatCut) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Meat cut not found'
      }
    });
  }

  // If Google Drive URL exists, redirect to it
  if (meatCut.googleDriveImageUrl) {
    return res.redirect(meatCut.googleDriveImageUrl);
  }

  // Otherwise, return 404 or placeholder
  res.status(404).json({
    success: false,
    error: {
      message: 'Image not available'
    }
  });
}));

/**
 * GET /api/filters/options
 * Get all available filter options
 */
router.get('/filters/options', asyncHandler(async (req, res) => {
  const options = SearchService.getFilterOptions();
  res.json(options);
}));

export default router;
