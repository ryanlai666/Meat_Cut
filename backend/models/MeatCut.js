import getDatabase from '../config/database.js';
import { generateSlug, generateUniqueSlugSync } from '../utils/slugGenerator.js';

/**
 * MeatCut Model
 * Handles database operations for meat cuts
 */
export class MeatCut {
  /**
   * Create a new meat cut
   * @param {object} data - Meat cut data
   * @returns {object} - Created meat cut
   */
  static create(data) {
    const db = getDatabase();
    
    // Generate slug if not provided
    if (!data.slug) {
      const baseSlug = generateSlug(data.name);
      data.slug = generateUniqueSlugSync(baseSlug, (slug) => {
        const existing = db.prepare('SELECT id FROM meat_cuts WHERE slug = ?').get(slug);
        return existing !== undefined;
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO meat_cuts (
        name, chinese_name, part, lean, price_min, price_max, price_mean,
        price_display, texture_notes, image_reference,
        google_drive_image_id, google_drive_image_url, slug
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.name,
      data.chineseName || data.chinese_name,
      data.part,
      data.lean ? 1 : 0,
      data.priceMin || data.price_min,
      data.priceMax || data.price_max,
      data.priceMean || data.price_mean,
      data.priceDisplay || data.price_display,
      data.textureNotes || data.texture_notes || null,
      data.imageReference || data.image_reference,
      data.googleDriveImageId || data.google_drive_image_id || null,
      data.googleDriveImageUrl || data.google_drive_image_url || null,
      data.slug
    );
    
    return this.findById(result.lastInsertRowid);
  }
  
  /**
   * Find meat cut by ID
   * @param {number} id - Meat cut ID
   * @returns {object|null} - Meat cut or null
   */
  static findById(id) {
    const db = getDatabase();
    const meatCut = db.prepare('SELECT * FROM meat_cuts WHERE id = ?').get(id);
    
    if (!meatCut) return null;
    
    return this.formatMeatCut(meatCut);
  }
  
  /**
   * Find meat cut by slug
   * @param {string} slug - Meat cut slug
   * @returns {object|null} - Meat cut or null
   */
  static findBySlug(slug) {
    const db = getDatabase();
    const meatCut = db.prepare('SELECT * FROM meat_cuts WHERE slug = ?').get(slug);
    
    if (!meatCut) return null;
    
    return this.formatMeatCut(meatCut);
  }
  
  /**
   * Get all meat cuts
   * @param {object} options - Query options (limit, offset)
   * @returns {Array} - Array of meat cuts
   */
  static findAll(options = {}) {
    const db = getDatabase();
    const { limit, offset } = options;
    
    let query = 'SELECT * FROM meat_cuts ORDER BY id';
    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }
    
    const meatCuts = db.prepare(query).all();
    return meatCuts.map(mc => this.formatMeatCut(mc));
  }
  
  /**
   * Update meat cut
   * @param {number} id - Meat cut ID
   * @param {object} data - Updated data
   * @returns {object|null} - Updated meat cut or null
   */
  static update(id, data) {
    const db = getDatabase();
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.chineseName !== undefined || data.chinese_name !== undefined) {
      updates.push('chinese_name = ?');
      values.push(data.chineseName || data.chinese_name);
    }
    if (data.part !== undefined) {
      updates.push('part = ?');
      values.push(data.part);
    }
    if (data.lean !== undefined) {
      updates.push('lean = ?');
      values.push(data.lean ? 1 : 0);
    }
    if (data.priceMin !== undefined || data.price_min !== undefined) {
      updates.push('price_min = ?');
      values.push(data.priceMin || data.price_min);
    }
    if (data.priceMax !== undefined || data.price_max !== undefined) {
      updates.push('price_max = ?');
      values.push(data.priceMax || data.price_max);
    }
    if (data.priceMean !== undefined || data.price_mean !== undefined) {
      updates.push('price_mean = ?');
      values.push(data.priceMean || data.price_mean);
    }
    if (data.priceDisplay !== undefined || data.price_display !== undefined) {
      updates.push('price_display = ?');
      values.push(data.priceDisplay || data.price_display);
    }
    if (data.textureNotes !== undefined || data.texture_notes !== undefined) {
      updates.push('texture_notes = ?');
      values.push(data.textureNotes || data.texture_notes || null);
    }
    if (data.imageReference !== undefined || data.image_reference !== undefined) {
      updates.push('image_reference = ?');
      values.push(data.imageReference || data.image_reference);
    }
    if (data.googleDriveImageId !== undefined || data.google_drive_image_id !== undefined) {
      updates.push('google_drive_image_id = ?');
      values.push(data.googleDriveImageId || data.google_drive_image_id || null);
    }
    if (data.googleDriveImageUrl !== undefined || data.google_drive_image_url !== undefined) {
      updates.push('google_drive_image_url = ?');
      values.push(data.googleDriveImageUrl || data.google_drive_image_url || null);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const query = `UPDATE meat_cuts SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);
    
    return this.findById(id);
  }
  
  /**
   * Delete meat cut
   * @param {number} id - Meat cut ID
   * @returns {boolean} - True if deleted
   */
  static delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM meat_cuts WHERE id = ?').run(id);
    return result.changes > 0;
  }
  
  /**
   * Get cooking methods for a meat cut
   * @param {number} meatCutId - Meat cut ID
   * @returns {Array} - Array of cooking method names
   */
  static getCookingMethods(meatCutId) {
    const db = getDatabase();
    const methods = db.prepare(`
      SELECT cm.name
      FROM cooking_methods cm
      JOIN meat_cut_cooking_methods mccm ON cm.id = mccm.cooking_method_id
      WHERE mccm.meat_cut_id = ?
      ORDER BY cm.name
    `).all(meatCutId);
    
    return methods.map(m => m.name);
  }
  
  /**
   * Get recommended dishes for a meat cut
   * @param {number} meatCutId - Meat cut ID
   * @returns {Array} - Array of recommended dish names
   */
  static getRecommendedDishes(meatCutId) {
    const db = getDatabase();
    const dishes = db.prepare(`
      SELECT rd.name
      FROM recommended_dishes rd
      JOIN meat_cut_recommended_dishes mcrd ON rd.id = mcrd.recommended_dish_id
      WHERE mcrd.meat_cut_id = ?
      ORDER BY rd.name
    `).all(meatCutId);
    
    return dishes.map(d => d.name);
  }
  
  /**
   * Format meat cut for API response
   * @param {object} meatCut - Raw meat cut from database
   * @returns {object} - Formatted meat cut
   */
  static formatMeatCut(meatCut) {
    return {
      id: meatCut.id,
      name: meatCut.name,
      chineseName: meatCut.chinese_name,
      part: meatCut.part,
      lean: meatCut.lean === 1,
      priceRange: {
        min: meatCut.price_min,
        max: meatCut.price_max,
        mean: meatCut.price_mean,
        display: meatCut.price_display
      },
      textureNotes: meatCut.texture_notes,
      imageReference: meatCut.image_reference,
      googleDriveImageId: meatCut.google_drive_image_id,
      googleDriveImageUrl: meatCut.google_drive_image_url,
      slug: meatCut.slug,
      createdAt: meatCut.created_at,
      updatedAt: meatCut.updated_at
    };
  }
}

export default MeatCut;
