import getDatabase from '../config/database.js';
import MeatCut from '../models/MeatCut.js';

/**
 * Search Service
 * Handles search and filtering logic for meat cuts
 */
export class SearchService {
  /**
   * Search meat cuts with filters
   * @param {object} filters - Search filters
   * @returns {object} - Search results with total count
   */
  static search(filters = {}) {
    const db = getDatabase();
    const {
      q = '',
      priceMin,
      priceMax,
      part,
      lean,
      cookingMethod
    } = filters;

    // Build WHERE clause
    const conditions = [];
    const params = [];

    // Text search (name, chinese_name, part)
    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      conditions.push(`(
        mc.name LIKE ? OR 
        mc.chinese_name LIKE ? OR 
        mc.part LIKE ?
      )`);
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Price range filter
    if (priceMin !== undefined && priceMin !== null) {
      conditions.push('mc.price_max >= ?');
      params.push(priceMin);
    }
    if (priceMax !== undefined && priceMax !== null) {
      conditions.push('mc.price_min <= ?');
      params.push(priceMax);
    }

    // Part filter
    if (part && part.trim()) {
      conditions.push('mc.part = ?');
      params.push(part.trim());
    }

    // Lean filter
    if (lean !== undefined && lean !== null) {
      conditions.push('mc.lean = ?');
      params.push(lean ? 1 : 0);
    }

    // Cooking method filter
    let joinClause = '';
    if (cookingMethod && cookingMethod.trim()) {
      joinClause = `
        JOIN meat_cut_cooking_methods mccm ON mc.id = mccm.meat_cut_id
        JOIN cooking_methods cm ON mccm.cooking_method_id = cm.id
      `;
      conditions.push('cm.name = ?');
      params.push(cookingMethod.trim());
    }

    // Build query
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT mc.id) as total
      FROM meat_cuts mc
      ${joinClause}
      ${whereClause}
    `;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;

    // Get results
    const query = `
      SELECT DISTINCT mc.*
      FROM meat_cuts mc
      ${joinClause}
      ${whereClause}
      ORDER BY mc.name
    `;
    const meatCuts = db.prepare(query).all(...params);

    // Format results
    const results = meatCuts.map(mc => {
      const formatted = MeatCut.formatMeatCut(mc);
      const cookingMethods = MeatCut.getCookingMethods(mc.id);
      const recommendedDishes = MeatCut.getRecommendedDishes(mc.id);
      
      return {
        ...formatted,
        cookingMethods,
        recommendedDishes,
        imageUrl: formatted.googleDriveImageUrl || null
      };
    });

    // Get price range for all meat cuts
    const priceRangeQuery = 'SELECT MIN(price_min) as min, MAX(price_max) as max FROM meat_cuts';
    const priceRange = db.prepare(priceRangeQuery).get();

    return {
      results,
      total,
      priceRange: {
        min: priceRange.min || 0,
        max: priceRange.max || 0
      }
    };
  }

  /**
   * Get all available filter options
   * @returns {object} - Filter options
   */
  static getFilterOptions() {
    const db = getDatabase();

    // Get all unique parts
    const parts = db.prepare(`
      SELECT DISTINCT part 
      FROM meat_cuts 
      WHERE part IS NOT NULL AND part != ''
      ORDER BY part
    `).all().map(r => r.part);

    // Get all cooking methods
    const cookingMethods = db.prepare(`
      SELECT DISTINCT name 
      FROM cooking_methods 
      ORDER BY name
    `).all().map(r => r.name);

    // Get price range
    const priceRange = db.prepare(`
      SELECT MIN(price_min) as min, MAX(price_max) as max 
      FROM meat_cuts
    `).get();

    return {
      parts,
      cookingMethods,
      priceRange: {
        min: priceRange.min || 0,
        max: priceRange.max || 0
      }
    };
  }
}

export default SearchService;
