import getDatabase from '../config/database.js';

/**
 * RecommendedDish Model
 * Handles database operations for recommended dishes
 */
export class RecommendedDish {
  /**
   * Create or get recommended dish by name
   * @param {string} name - Recommended dish name
   * @returns {object} - Recommended dish
   */
  static findOrCreate(name) {
    const db = getDatabase();
    
    // Try to find existing
    let dish = db.prepare('SELECT * FROM recommended_dishes WHERE name = ?').get(name);
    
    if (!dish) {
      // Create new
      const stmt = db.prepare('INSERT INTO recommended_dishes (name) VALUES (?)');
      const result = stmt.run(name);
      dish = db.prepare('SELECT * FROM recommended_dishes WHERE id = ?').get(result.lastInsertRowid);
    }
    
    return {
      id: dish.id,
      name: dish.name,
      createdAt: dish.created_at
    };
  }
  
  /**
   * Find recommended dish by ID
   * @param {number} id - Recommended dish ID
   * @returns {object|null} - Recommended dish or null
   */
  static findById(id) {
    const db = getDatabase();
    const dish = db.prepare('SELECT * FROM recommended_dishes WHERE id = ?').get(id);
    
    if (!dish) return null;
    
    return {
      id: dish.id,
      name: dish.name,
      createdAt: dish.created_at
    };
  }
  
  /**
   * Get all recommended dishes
   * @returns {Array} - Array of recommended dishes
   */
  static findAll() {
    const db = getDatabase();
    const dishes = db.prepare('SELECT * FROM recommended_dishes ORDER BY name').all();
    
    return dishes.map(d => ({
      id: d.id,
      name: d.name,
      createdAt: d.created_at
    }));
  }
  
  /**
   * Associate recommended dish with meat cut
   * @param {number} meatCutId - Meat cut ID
   * @param {number} recommendedDishId - Recommended dish ID
   * @returns {boolean} - True if associated
   */
  static associateWithMeatCut(meatCutId, recommendedDishId) {
    const db = getDatabase();
    
    try {
      db.prepare(`
        INSERT OR IGNORE INTO meat_cut_recommended_dishes (meat_cut_id, recommended_dish_id)
        VALUES (?, ?)
      `).run(meatCutId, recommendedDishId);
      return true;
    } catch (error) {
      console.error('Error associating recommended dish with meat cut:', error);
      return false;
    }
  }
}

export default RecommendedDish;
