import getDatabase from '../config/database.js';

/**
 * CookingMethod Model
 * Handles database operations for cooking methods
 */
export class CookingMethod {
  /**
   * Create or get cooking method by name
   * @param {string} name - Cooking method name
   * @returns {object} - Cooking method
   */
  static findOrCreate(name) {
    const db = getDatabase();
    
    // Try to find existing
    let method = db.prepare('SELECT * FROM cooking_methods WHERE name = ?').get(name);
    
    if (!method) {
      // Create new
      const stmt = db.prepare('INSERT INTO cooking_methods (name) VALUES (?)');
      const result = stmt.run(name);
      method = db.prepare('SELECT * FROM cooking_methods WHERE id = ?').get(result.lastInsertRowid);
    }
    
    return {
      id: method.id,
      name: method.name,
      createdAt: method.created_at
    };
  }
  
  /**
   * Find cooking method by ID
   * @param {number} id - Cooking method ID
   * @returns {object|null} - Cooking method or null
   */
  static findById(id) {
    const db = getDatabase();
    const method = db.prepare('SELECT * FROM cooking_methods WHERE id = ?').get(id);
    
    if (!method) return null;
    
    return {
      id: method.id,
      name: method.name,
      createdAt: method.created_at
    };
  }
  
  /**
   * Get all cooking methods
   * @returns {Array} - Array of cooking methods
   */
  static findAll() {
    const db = getDatabase();
    const methods = db.prepare('SELECT * FROM cooking_methods ORDER BY name').all();
    
    return methods.map(m => ({
      id: m.id,
      name: m.name,
      createdAt: m.created_at
    }));
  }
  
  /**
   * Associate cooking method with meat cut
   * @param {number} meatCutId - Meat cut ID
   * @param {number} cookingMethodId - Cooking method ID
   * @returns {boolean} - True if associated
   */
  static associateWithMeatCut(meatCutId, cookingMethodId) {
    const db = getDatabase();
    
    try {
      db.prepare(`
        INSERT OR IGNORE INTO meat_cut_cooking_methods (meat_cut_id, cooking_method_id)
        VALUES (?, ?)
      `).run(meatCutId, cookingMethodId);
      return true;
    } catch (error) {
      console.error('Error associating cooking method with meat cut:', error);
      return false;
    }
  }
}

export default CookingMethod;
