import express from 'express';
import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';
import CookingMethod from '../models/CookingMethod.js';
import RecommendedDish from '../models/RecommendedDish.js';
import googleDriveService from '../services/googleDriveService.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateMeatCut, normalizeLean } from '../utils/validators.js';

const router = express.Router();

// All admin routes require authentication
router.use(authenticateAdmin);

/**
 * GET /api/admin/meat-cuts
 * List all meat cuts (for admin interface)
 */
router.get('/meat-cuts', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const meatCuts = MeatCut.findAll({ limit, offset });
  const total = getDatabase().prepare('SELECT COUNT(*) as count FROM meat_cuts').get().count;

  // Add related data for each meat cut
  const meatCutsWithRelations = meatCuts.map(mc => ({
    ...mc,
    cookingMethods: MeatCut.getCookingMethods(mc.id),
    recommendedDishes: MeatCut.getRecommendedDishes(mc.id),
    imageUrl: mc.googleDriveImageUrl || null
  }));

  res.json({
    meatCuts: meatCutsWithRelations,
    total,
    page,
    limit
  });
}));

/**
 * GET /api/admin/meat-cuts/:id
 * Get single meat cut by ID (for admin interface)
 */
router.get('/meat-cuts/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid meat cut ID'
      }
    });
  }

  const meatCut = MeatCut.findById(id);
  
  if (!meatCut) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Meat cut not found'
      }
    });
  }

  // Add related data
  const cookingMethods = MeatCut.getCookingMethods(meatCut.id);
  const recommendedDishes = MeatCut.getRecommendedDishes(meatCut.id);

  res.json({
    ...meatCut,
    cookingMethods,
    recommendedDishes,
    imageUrl: meatCut.googleDriveImageUrl || null
  });
}));

/**
 * POST /api/admin/meat-cuts
 * Create new meat cut
 */
router.post('/meat-cuts', asyncHandler(async (req, res) => {
  const data = req.body;

  // Validate data
  const validation = validateMeatCut(data);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: validation.errors
      }
    });
  }

  // Prepare data for creation
  const meatCutData = {
    name: data.name.trim(),
    chineseName: data.chineseName || data.chinese_name,
    part: data.part.trim(),
    lean: normalizeLean(data.lean),
    priceMin: parseFloat(data.priceMin || data.price_min),
    priceMax: parseFloat(data.priceMax || data.price_max),
    priceMean: data.priceMean || data.price_mean || ((parseFloat(data.priceMin || data.price_min) + parseFloat(data.priceMax || data.price_max)) / 2),
    priceDisplay: data.priceDisplay || data.price_display || `$${data.priceMin || data.price_min} – $${data.priceMax || data.price_max}`,
    textureNotes: data.textureNotes || data.texture_notes || null,
    imageReference: data.imageReference || data.image_reference,
    googleDriveImageId: data.googleDriveImageId || data.google_drive_image_id || null,
    googleDriveImageUrl: data.googleDriveImageUrl || data.google_drive_image_url || null
  };

  // Handle image upload if imageFile is provided (base64)
  if (data.imageFile) {
    try {
      const fileName = `${meatCutData.imageReference || meatCutData.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      const uploadResult = await googleDriveService.uploadImage(data.imageFile, fileName);
      meatCutData.googleDriveImageId = uploadResult.fileId;
      meatCutData.googleDriveImageUrl = uploadResult.imageUrl;
    } catch (uploadError) {
      console.error('Image upload failed during meat cut creation:', uploadError);
      // We continue with creation but without image, or should we fail?
      // For now, let's just log and continue, as the validation already passed
    }
  }

  // Create meat cut
  const meatCut = MeatCut.create(meatCutData);

  // Associate cooking methods
  if (data.cookingMethods && Array.isArray(data.cookingMethods)) {
    for (const methodName of data.cookingMethods) {
      const method = CookingMethod.findOrCreate(methodName.trim());
      CookingMethod.associateWithMeatCut(meatCut.id, method.id);
    }
  }

  // Associate recommended dishes
  if (data.recommendedDishes && Array.isArray(data.recommendedDishes)) {
    for (const dishName of data.recommendedDishes) {
      const dish = RecommendedDish.findOrCreate(dishName.trim());
      RecommendedDish.associateWithMeatCut(meatCut.id, dish.id);
    }
  }

  // Update metadata
  const db = getDatabase();
  db.prepare(`
    UPDATE metadata 
    SET value = datetime('now'), updated_at = datetime('now')
    WHERE key = 'last_meat_cuts_update'
  `).run();

  // Get full meat cut with relations
  const fullMeatCut = {
    ...meatCut,
    cookingMethods: MeatCut.getCookingMethods(meatCut.id),
    recommendedDishes: MeatCut.getRecommendedDishes(meatCut.id),
    imageUrl: meatCut.googleDriveImageUrl || null
  };

  res.status(201).json(fullMeatCut);
}));

/**
 * PUT /api/admin/meat-cuts/:id
 * Update meat cut
 */
router.put('/meat-cuts/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid meat cut ID'
      }
    });
  }

  // Check if meat cut exists
  const existing = MeatCut.findById(id);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Meat cut not found'
      }
    });
  }

  const data = req.body;
  const updateData = {};

  // Build update data
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.chineseName !== undefined || data.chinese_name !== undefined) {
    updateData.chineseName = data.chineseName || data.chinese_name;
  }
  if (data.part !== undefined) updateData.part = data.part.trim();
  if (data.lean !== undefined) updateData.lean = normalizeLean(data.lean);
  if (data.priceMin !== undefined || data.price_min !== undefined) {
    updateData.priceMin = parseFloat(data.priceMin || data.price_min);
  }
  if (data.priceMax !== undefined || data.price_max !== undefined) {
    updateData.priceMax = parseFloat(data.priceMax || data.price_max);
  }
  if (data.priceMean !== undefined || data.price_mean !== undefined) {
    updateData.priceMean = parseFloat(data.priceMean || data.price_mean);
  }
  if (data.priceDisplay !== undefined || data.price_display !== undefined) {
    updateData.priceDisplay = data.priceDisplay || data.price_display;
  }
  if (data.textureNotes !== undefined || data.texture_notes !== undefined) {
    updateData.textureNotes = data.textureNotes || data.texture_notes || null;
  }
  if (data.imageReference !== undefined || data.image_reference !== undefined) {
    updateData.imageReference = data.imageReference || data.image_reference;
  }
  if (data.googleDriveImageId !== undefined || data.google_drive_image_id !== undefined) {
    updateData.googleDriveImageId = data.googleDriveImageId || data.google_drive_image_id || null;
  }
  if (data.googleDriveImageUrl !== undefined || data.google_drive_image_url !== undefined) {
    updateData.googleDriveImageUrl = data.googleDriveImageUrl || data.google_drive_image_url || null;
  }

  // Handle image upload if imageFile is provided (base64)
  if (data.imageFile) {
    try {
      const imageReference = data.imageReference || data.image_reference || existing.imageReference;
      const fileName = `${imageReference || existing.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      
      let uploadResult;
      if (existing.googleDriveImageId) {
        // Update existing image
        uploadResult = await googleDriveService.updateImage(existing.googleDriveImageId, data.imageFile);
      } else {
        // Upload new image
        uploadResult = await googleDriveService.uploadImage(data.imageFile, fileName);
      }
      
      updateData.googleDriveImageId = uploadResult.fileId;
      updateData.googleDriveImageUrl = uploadResult.imageUrl;
    } catch (uploadError) {
      console.error('Image upload failed during meat cut update:', uploadError);
    }
  }

  // Update meat cut
  const updated = MeatCut.update(id, updateData);

  // Update cooking methods if provided
  if (data.cookingMethods !== undefined) {
    if (Array.isArray(data.cookingMethods)) {
      const db = getDatabase();
      // Remove existing associations
      db.prepare('DELETE FROM meat_cut_cooking_methods WHERE meat_cut_id = ?').run(id);
      // Add new associations
      for (const methodName of data.cookingMethods) {
        if (methodName && methodName.trim()) {
          const method = CookingMethod.findOrCreate(methodName.trim());
          CookingMethod.associateWithMeatCut(id, method.id);
        }
      }
    }
  }

  // Update recommended dishes if provided
  if (data.recommendedDishes !== undefined) {
    if (Array.isArray(data.recommendedDishes)) {
      const db = getDatabase();
      // Remove existing associations
      db.prepare('DELETE FROM meat_cut_recommended_dishes WHERE meat_cut_id = ?').run(id);
      // Add new associations
      for (const dishName of data.recommendedDishes) {
        if (dishName && dishName.trim()) {
          const dish = RecommendedDish.findOrCreate(dishName.trim());
          RecommendedDish.associateWithMeatCut(id, dish.id);
        }
      }
    }
  }

  // Update metadata
  const db = getDatabase();
  db.prepare(`
    UPDATE metadata 
    SET value = datetime('now'), updated_at = datetime('now')
    WHERE key = 'last_meat_cuts_update'
  `).run();

  // Get full meat cut with relations
  const fullMeatCut = {
    ...updated,
    cookingMethods: MeatCut.getCookingMethods(updated.id),
    recommendedDishes: MeatCut.getRecommendedDishes(updated.id),
    imageUrl: updated.googleDriveImageUrl || null
  };

  res.json(fullMeatCut);
}));

/**
 * DELETE /api/admin/meat-cuts/:id
 * Delete meat cut
 */
router.delete('/meat-cuts/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid meat cut ID'
      }
    });
  }

  // Check if meat cut exists
  const existing = MeatCut.findById(id);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Meat cut not found'
      }
    });
  }

  // Delete image from Google Drive if googleDriveImageId exists
  if (existing.googleDriveImageId) {
    try {
      await googleDriveService.deleteImage(existing.googleDriveImageId);
    } catch (error) {
      console.error('Failed to delete image from Google Drive:', error);
      // We continue with deletion from DB even if Drive deletion fails
    }
  }

  // Delete meat cut (CASCADE will handle related records)
  const deleted = MeatCut.delete(id);

  if (!deleted) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete meat cut'
      }
    });
  }

  // Update metadata
  const db = getDatabase();
  db.prepare(`
    UPDATE metadata 
    SET value = datetime('now'), updated_at = datetime('now')
    WHERE key = 'last_meat_cuts_update'
  `).run();

  res.json({
    success: true,
    message: 'Meat cut deleted'
  });
}));

/**
 * GET /api/admin/cooking-methods
 * List all cooking methods
 */
router.get('/cooking-methods', asyncHandler(async (req, res) => {
  const cookingMethods = CookingMethod.findAll();
  res.json({ cookingMethods });
}));

/**
 * GET /api/admin/recommended-dishes
 * List all recommended dishes
 */
router.get('/recommended-dishes', asyncHandler(async (req, res) => {
  const recommendedDishes = RecommendedDish.findAll();
  res.json({ recommendedDishes });
}));

/**
 * GET /api/admin/tags
 * List all tags (parts + cooking methods)
 */
router.get('/tags', asyncHandler(async (req, res) => {
  const db = getDatabase();
  
  // Get all unique parts
  const parts = db.prepare(`
    SELECT DISTINCT part 
    FROM meat_cuts 
    WHERE part IS NOT NULL AND part != ''
    ORDER BY part
  `).all().map(r => r.part);

  // Get all cooking methods
  const cookingMethods = CookingMethod.findAll().map(m => m.name);

  res.json({
    parts,
    cookingMethods
  });
}));

export default router;
