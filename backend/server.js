import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase, getDatabase } from './config/database.js';
import { importDefaultCSV } from './utils/csvImporter.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database and import data
async function initializeApp() {
  try {
    console.log('Initializing database...');
    initializeDatabase();
    
    // Check if database is empty (no meat cuts)
    const db = getDatabase();
    const count = db.prepare('SELECT COUNT(*) as count FROM meat_cuts').get();
    
    if (count.count === 0) {
      console.log('Database is empty. Importing CSV data...');
      const result = await importDefaultCSV();
      
      if (result.success) {
        console.log(`Successfully imported ${result.imported} meat cuts`);
        if (result.errors.length > 0) {
          console.warn(`Warning: ${result.errors.length} errors during import:`);
          result.errors.forEach(err => {
            console.warn(`  Row ${err.row}: ${err.error}`);
          });
        }
      } else {
        console.error('Failed to import CSV data');
        result.errors.forEach(err => {
          console.error(`  Row ${err.row}: ${err.error}`);
        });
      }
    } else {
      console.log(`Database already contains ${count.count} meat cuts`);
    }
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API health check route (matching the plan)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initializeApp();
});
