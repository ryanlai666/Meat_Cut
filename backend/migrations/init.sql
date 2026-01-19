-- Meat Cuts App Database Schema
-- SQLite Database Initialization

-- Main meat_cuts table
CREATE TABLE IF NOT EXISTS meat_cuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    chinese_name TEXT NOT NULL,
    part TEXT NOT NULL,
    lean BOOLEAN NOT NULL,
    price_min REAL NOT NULL,
    price_max REAL NOT NULL,
    price_mean REAL NOT NULL,
    price_display TEXT NOT NULL,
    texture_notes TEXT,
    image_reference TEXT NOT NULL,
    google_drive_image_id TEXT,
    google_drive_image_url TEXT,
    slug TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meat_cuts_slug ON meat_cuts(slug);
CREATE INDEX IF NOT EXISTS idx_meat_cuts_part ON meat_cuts(part);
CREATE INDEX IF NOT EXISTS idx_meat_cuts_name ON meat_cuts(name);
CREATE INDEX IF NOT EXISTS idx_meat_cuts_chinese_name ON meat_cuts(chinese_name);

-- Cooking methods table
CREATE TABLE IF NOT EXISTS cooking_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cooking_methods_name ON cooking_methods(name);

-- Recommended dishes table
CREATE TABLE IF NOT EXISTS recommended_dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommended_dishes_name ON recommended_dishes(name);

-- Junction table for meat_cuts and cooking_methods
CREATE TABLE IF NOT EXISTS meat_cut_cooking_methods (
    meat_cut_id INTEGER NOT NULL,
    cooking_method_id INTEGER NOT NULL,
    PRIMARY KEY (meat_cut_id, cooking_method_id),
    FOREIGN KEY (meat_cut_id) REFERENCES meat_cuts(id) ON DELETE CASCADE,
    FOREIGN KEY (cooking_method_id) REFERENCES cooking_methods(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mccm_meat_cut ON meat_cut_cooking_methods(meat_cut_id);
CREATE INDEX IF NOT EXISTS idx_mccm_cooking_method ON meat_cut_cooking_methods(cooking_method_id);

-- Junction table for meat_cuts and recommended_dishes
CREATE TABLE IF NOT EXISTS meat_cut_recommended_dishes (
    meat_cut_id INTEGER NOT NULL,
    recommended_dish_id INTEGER NOT NULL,
    PRIMARY KEY (meat_cut_id, recommended_dish_id),
    FOREIGN KEY (meat_cut_id) REFERENCES meat_cuts(id) ON DELETE CASCADE,
    FOREIGN KEY (recommended_dish_id) REFERENCES recommended_dishes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcrd_meat_cut ON meat_cut_recommended_dishes(meat_cut_id);
CREATE INDEX IF NOT EXISTS idx_mcrd_dish ON meat_cut_recommended_dishes(recommended_dish_id);

-- Metadata table
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize metadata
INSERT OR IGNORE INTO metadata (key, value) VALUES 
    ('last_meat_cuts_update', datetime('now')),
    ('google_drive_folder_id', ''),
    ('app_version', '1.0.0');
