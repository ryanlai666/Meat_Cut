import express from 'express';
import multer from 'multer';
import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';
import CookingMethod from '../models/CookingMethod.js';
import RecommendedDish from '../models/RecommendedDish.js';
import googleDriveService from '../services/googleDriveService.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateMeatCut, normalizeLean } from '../utils/validators.js';
import { exportMeatCutsToCSVWithFilename } from '../utils/csvExporter.js';

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/admin/login
 * Admin login (no authentication required)
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (username === expectedUsername && password === expectedPassword) {
    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    res.json({
      success: true,
      token,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid credentials'
      }
    });
  }
}));

// All other admin routes require authentication
router.use(authenticateAdmin);

/**
 * GET /api/admin/meat-cuts
 * List all meat cuts (for admin interface)
 */
router.get('/meat-cuts', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const orderBy = req.query.orderBy || 'name'; // Default to 'name' to match public view

  const meatCuts = MeatCut.findAll({ limit, offset, orderBy });
  const total = getDatabase().prepare('SELECT COUNT(*) as count FROM meat_cuts').get().count;

  // Add related data for each meat cut
  const meatCutsWithRelations = meatCuts.map(mc => ({
    ...mc,
    cookingMethods: MeatCut.getCookingMethods(mc.id),
    recommendedDishes: MeatCut.getRecommendedDishes(mc.id),
    imageUrl: mc.googleDriveImageId ? `/api/drive/image/${mc.googleDriveImageId}` : null,
    // Include googleDriveImageId and googleDriveImageUrl for frontend use
    googleDriveImageId: mc.googleDriveImageId,
    googleDriveImageUrl: mc.googleDriveImageUrl
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
    imageUrl: meatCut.googleDriveImageId ? `/api/drive/image/${meatCut.googleDriveImageId}` : null,
    // Include googleDriveImageId and googleDriveImageUrl for frontend use
    googleDriveImageId: meatCut.googleDriveImageId,
    googleDriveImageUrl: meatCut.googleDriveImageUrl
  });
}));

/**
 * POST /api/admin/meat-cuts
 * Create new meat cut
 */
router.post('/meat-cuts', upload.single('imageFile'), asyncHandler(async (req, res) => {
  const data = req.body;
  const file = req.file;

  // Parse array fields from FormData
  let cookingMethods = [];
  if (data.cookingMethods) {
    if (Array.isArray(data.cookingMethods)) {
      cookingMethods = data.cookingMethods;
    } else if (typeof data.cookingMethods === 'string') {
      // Handle both single value and array notation
      if (data.cookingMethods.startsWith('[') && data.cookingMethods.endsWith(']')) {
        cookingMethods = JSON.parse(data.cookingMethods);
      } else {
        cookingMethods = [data.cookingMethods];
      }
    }
  }

  // Prepare data for creation
  const meatCutData = {
    name: (data.name || '').trim(),
    chineseName: data.chineseName || data.chinese_name || '',
    part: (data.part || 'Other').trim(),
    lean: normalizeLean(data.lean),
    priceMin: parseFloat(data.priceMin || data.price_min || '0'),
    priceMax: parseFloat(data.priceMax || data.price_max || '0'),
    priceMean: data.priceMean || data.price_mean || ((parseFloat(data.priceMin || data.price_min || '0') + parseFloat(data.priceMax || data.price_max || '0')) / 2),
    priceDisplay: data.priceDisplay || data.price_display || `$${data.priceMin || data.price_min || '0'} – $${data.priceMax || data.price_max || '0'}`,
    textureNotes: data.textureNotes || data.texture_notes || null,
    imageReference: data.imageReference || data.image_reference || '',
    googleDriveImageId: data.googleDriveImageId || data.google_drive_image_id || null,
    googleDriveImageUrl: data.googleDriveImageUrl || data.google_drive_image_url || null
  };

  // Handle image upload
  if (file) {
    try {
      // Convert buffer to base64
      const base64Image = file.buffer.toString('base64');
      const fileName = `${meatCutData.imageReference || meatCutData.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      const uploadResult = await googleDriveService.uploadImage(base64Image, fileName);
      meatCutData.googleDriveImageId = uploadResult.fileId;
      meatCutData.googleDriveImageUrl = uploadResult.imageUrl;
    } catch (uploadError) {
      console.error('Image upload failed during meat cut creation:', uploadError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to upload image: ' + uploadError.message
        }
      });
    }
  } else if (data.googleDriveImageId) {
    // Use existing Google Drive image
    meatCutData.googleDriveImageId = data.googleDriveImageId;
    meatCutData.googleDriveImageUrl = googleDriveService.getImageUrl(data.googleDriveImageId);
  }

  // Create meat cut
  const meatCut = MeatCut.create(meatCutData);

  // Associate cooking methods (tags)
  for (const methodName of cookingMethods) {
    if (methodName && methodName.trim()) {
      const method = CookingMethod.findOrCreate(methodName.trim());
      CookingMethod.associateWithMeatCut(meatCut.id, method.id);
    }
  }

  // Associate recommended dishes (if provided)
  if (data.recommendedDishes) {
    const dishes = Array.isArray(data.recommendedDishes) 
      ? data.recommendedDishes 
      : (typeof data.recommendedDishes === 'string' ? [data.recommendedDishes] : []);
    for (const dishName of dishes) {
      if (dishName && dishName.trim()) {
        const dish = RecommendedDish.findOrCreate(dishName.trim());
        RecommendedDish.associateWithMeatCut(meatCut.id, dish.id);
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
    ...meatCut,
    cookingMethods: MeatCut.getCookingMethods(meatCut.id),
    recommendedDishes: MeatCut.getRecommendedDishes(meatCut.id),
    imageUrl: meatCut.googleDriveImageId ? `/api/drive/image/${meatCut.googleDriveImageId}` : null,
    // Include googleDriveImageId and googleDriveImageUrl for frontend use
    googleDriveImageId: meatCut.googleDriveImageId,
    googleDriveImageUrl: meatCut.googleDriveImageUrl
  };

  res.status(201).json(fullMeatCut);
}));

/**
 * PUT /api/admin/meat-cuts/:id
 * Update meat cut
 */
router.put('/meat-cuts/:id', upload.single('imageFile'), asyncHandler(async (req, res) => {
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
  const file = req.file;
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

  // Handle image upload if file is provided
  if (file) {
    try {
      const imageReference = data.imageReference || data.image_reference || existing.imageReference;
      const fileName = `${imageReference || existing.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      
      // Convert buffer to base64
      const base64Image = file.buffer.toString('base64');
      
      let uploadResult;
      if (existing.googleDriveImageId) {
        // Update existing image
        uploadResult = await googleDriveService.updateImage(existing.googleDriveImageId, base64Image);
      } else {
        // Upload new image
        uploadResult = await googleDriveService.uploadImage(base64Image, fileName);
      }
      
      updateData.googleDriveImageId = uploadResult.fileId;
      updateData.googleDriveImageUrl = uploadResult.imageUrl;
    } catch (uploadError) {
      console.error('Image upload failed during meat cut update:', uploadError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to upload image: ' + uploadError.message
        }
      });
    }
  } else if (data.googleDriveImageId && data.googleDriveImageId !== existing.googleDriveImageId) {
    // Use different existing Google Drive image
    updateData.googleDriveImageId = data.googleDriveImageId;
    updateData.googleDriveImageUrl = googleDriveService.getImageUrl(data.googleDriveImageId);
  }

  // Update meat cut
  const updated = MeatCut.update(id, updateData);

  // Update cooking methods if provided
  if (data.cookingMethods !== undefined) {
    let cookingMethods = [];
    if (Array.isArray(data.cookingMethods)) {
      cookingMethods = data.cookingMethods;
    } else if (typeof data.cookingMethods === 'string') {
      if (data.cookingMethods.startsWith('[') && data.cookingMethods.endsWith(']')) {
        cookingMethods = JSON.parse(data.cookingMethods);
      } else {
        cookingMethods = [data.cookingMethods];
      }
    }
    
    const db = getDatabase();
    // Remove existing associations
    db.prepare('DELETE FROM meat_cut_cooking_methods WHERE meat_cut_id = ?').run(id);
    // Add new associations
    for (const methodName of cookingMethods) {
      if (methodName && methodName.trim()) {
        const method = CookingMethod.findOrCreate(methodName.trim());
        CookingMethod.associateWithMeatCut(id, method.id);
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
    imageUrl: updated.googleDriveImageId ? `/api/drive/image/${updated.googleDriveImageId}` : null,
    // Include googleDriveImageId and googleDriveImageUrl for frontend use
    googleDriveImageId: updated.googleDriveImageId,
    googleDriveImageUrl: updated.googleDriveImageUrl
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


/**
 * POST /api/admin/meat-cuts/bulk-delete
 * Delete multiple meat cuts
 */
router.post('/meat-cuts/bulk-delete', asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid IDs array'
      }
    });
  }

  const db = getDatabase();
  const deletedIds = [];
  const errors = [];

  for (const id of ids) {
    try {
      const meatCut = MeatCut.findById(parseInt(id));
      if (!meatCut) {
        errors.push({ id, error: 'Not found' });
        continue;
      }

      // Delete image from Google Drive if exists
      if (meatCut.googleDriveImageId) {
        try {
          await googleDriveService.deleteImage(meatCut.googleDriveImageId);
        } catch (error) {
          console.error(`Failed to delete image ${meatCut.googleDriveImageId}:`, error);
          // Continue with DB deletion even if Drive deletion fails
        }
      }

      // Delete from database
      const deleted = MeatCut.delete(parseInt(id));
      if (deleted) {
        deletedIds.push(id);
      } else {
        errors.push({ id, error: 'Failed to delete' });
      }
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  // Update metadata
  if (deletedIds.length > 0) {
    db.prepare(`
      UPDATE metadata 
      SET value = datetime('now'), updated_at = datetime('now')
      WHERE key = 'last_meat_cuts_update'
    `).run();
  }

  res.json({
    success: true,
    deleted: deletedIds.length,
    deletedIds,
    errors
  });
}));

/**
 * GET /api/admin/export/csv
 * Export all meat cuts to CSV format (download)
 */
router.get('/export/csv', asyncHandler(async (req, res) => {
  const { content, filename } = exportMeatCutsToCSVWithFilename();
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}));

/**
 * POST /api/admin/sync/csv-to-drive
 * Export database to CSV and upload to Google Drive
 */
router.post('/sync/csv-to-drive', asyncHandler(async (req, res) => {
  try {
    const { content, filename } = exportMeatCutsToCSVWithFilename();
    
    // Upload to Google Drive
    const uploadResult = await googleDriveService.uploadCSV(content, filename);
    
    // Update metadata
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES ('last_csv_sync', datetime('now'), datetime('now'))
    `).run();
    
    res.json({
      success: true,
      message: 'CSV synced to Google Drive successfully',
      file: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        webViewLink: uploadResult.webViewLink,
        webContentLink: uploadResult.webContentLink
      }
    });
  } catch (error) {
    console.error('Error syncing CSV to Google Drive:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to sync CSV to Google Drive'
      }
    });
  }
}));

/**
 * GET /api/admin/drive/csv
 * List all CSV files in Google Drive
 */
router.get('/drive/csv', asyncHandler(async (req, res) => {
  try {
    const csvFiles = await googleDriveService.listCSVFiles();
    
    res.json({
      success: true,
      files: csvFiles.map(file => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
}));

/**
 * GET /api/admin/drive/csv/:id
 * Download a specific CSV file from Google Drive
 */
router.get('/drive/csv/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const csvContent = await googleDriveService.downloadCSV(id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="download_${id}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
}));

/**
 * DELETE /api/admin/drive/csv/:id
 * Delete a CSV file from Google Drive
 */
router.delete('/drive/csv/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await googleDriveService.deleteCSV(id);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'CSV file deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'CSV file not found'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
}));

/**
 * GET /api/admin/drive/images
 * List all images from Google Drive (enhanced)
 */
router.get('/drive/images', asyncHandler(async (req, res) => {
  try {
    const files = await googleDriveService.listFiles();
    const imageFiles = files
      .filter(file => file.mimeType && file.mimeType.startsWith('image/'))
      .map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        imageUrl: googleDriveService.getImageUrl(file.id)
      }));
    
    res.json({
      success: true,
      images: imageFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
}));

/**
 * POST /api/admin/drive/image
 * Upload an image directly to Google Drive images/ folder
 */
router.post('/drive/image', upload.single('imageFile'), asyncHandler(async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No image file provided'
        }
      });
    }

    // Convert buffer to base64
    const base64Image = file.buffer.toString('base64');
    const fileName = req.body.fileName || file.originalname || `image_${Date.now()}.jpg`;
    
    // Upload to Google Drive images folder
    const uploadResult = await googleDriveService.uploadImage(
      base64Image,
      fileName,
      file.mimetype || 'image/jpeg'
    );
    
    res.json({
      success: true,
      message: 'Image uploaded to Google Drive successfully',
      file: {
        id: uploadResult.fileId,
        name: fileName,
        imageUrl: uploadResult.imageUrl,
        webViewLink: uploadResult.webViewLink
      }
    });
  } catch (error) {
    console.error('Error uploading image to Google Drive:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to upload image to Google Drive'
      }
    });
  }
}));

/**
 * GET /api/admin/sync/status
 * Get synchronization status
 */
router.get('/sync/status', asyncHandler(async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get last sync times
    const lastMeatCutsUpdate = db.prepare(`
      SELECT value FROM metadata WHERE key = 'last_meat_cuts_update'
    `).get();
    
    const lastCSVSync = db.prepare(`
      SELECT value FROM metadata WHERE key = 'last_csv_sync'
    `).get();
    
    // Get counts
    const meatCutsCount = db.prepare('SELECT COUNT(*) as count FROM meat_cuts').get().count;
    const imagesWithDriveId = db.prepare(`
      SELECT COUNT(*) as count FROM meat_cuts WHERE google_drive_image_id IS NOT NULL
    `).get().count;
    
    // Get Drive folder info
    let imagesCount = 0;
    let csvCount = 0;
    let missingImages = [];
    try {
      const imageFiles = await googleDriveService.listFiles();
      const driveImageIds = new Set(imageFiles
        .filter(f => f.mimeType && f.mimeType.startsWith('image/'))
        .map(f => f.id));
      imagesCount = driveImageIds.size;
      
      // Check for meat cuts with Drive IDs that don't exist in Drive
      const meatCuts = MeatCut.findAll();
      for (const mc of meatCuts) {
        if (mc.googleDriveImageId && !driveImageIds.has(mc.googleDriveImageId)) {
          missingImages.push({
            id: mc.id,
            name: mc.name,
            driveImageId: mc.googleDriveImageId
          });
        }
      }
      
      const csvFiles = await googleDriveService.listCSVFiles();
      csvCount = csvFiles.length;
    } catch (error) {
      console.warn('Error getting Drive file counts:', error.message);
    }
    
    res.json({
      success: true,
      status: {
        database: {
          meatCutsCount,
          imagesWithDriveId,
          lastMeatCutsUpdate: lastMeatCutsUpdate?.value || null
        },
        googleDrive: {
          imagesCount,
          csvCount,
          imagesFolderId: googleDriveService.getFolderId(),
          csvFolderId: googleDriveService.getCSVFolderId(),
          lastCSVSync: lastCSVSync?.value || null
        },
        syncStatus: {
          imagesSynced: imagesCount === imagesWithDriveId && missingImages.length === 0,
          csvSynced: csvCount > 0,
          missingImages: missingImages.length > 0 ? missingImages : undefined,
          warnings: missingImages.length > 0 ? [
            `發現 ${missingImages.length} 個資料庫中的圖片 ID 在 Google Drive 中不存在`
          ] : []
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
}));

/**
 * GET /api/admin/drive/image/:id
 * Proxy an image from Google Drive
 */
router.get('/drive/image/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const buffer = await googleDriveService.downloadImage(id);
    
    // Set appropriate content type (default to jpeg if unknown)
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(buffer);
  } catch (error) {
    console.error(`Error proxying image ${id}:`, error.message);
    res.status(404).json({
      success: false,
      error: {
        message: 'Image not found'
      }
    });
  }
}));

export default router;
