# Beef Cut Gallery

A React TypeScript application for browsing and exploring beef cuts with detailed information, search, and filtering capabilities.

## Features

- **Browse Meat Cuts**: View detailed information about different beef cuts
- **Search**: Search by name (English or Chinese) and tags/cooking methods
- **Price Filter**: Filter cuts by price range using a slider
- **Sort Options**: Sort by Name A-Z, Cut, Cooking Method, or Price
- **Image Navigation**: Navigate through images with up/down arrows
- **Detailed Information**: View cooking methods, cut type, tags, and descriptions

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Data Folder

The application expects the data folder to be accessible. You have two options:

**Option A: Copy data folder to public directory (Recommended)**
```bash
# Windows PowerShell
Copy-Item -Path "data" -Destination "public\data" -Recurse -Force

# Or manually copy the data folder to the public folder
```

**Option B: Use symbolic link**
```bash
# Windows PowerShell (Run as Administrator)
New-Item -ItemType SymbolicLink -Path "public\data" -Target "$PWD\data"
```

### 3. Start Development Server

```bash
npm run dev
```

The application will open at `http://localhost:3000`

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── MeatCutDetail.tsx    # Main detail view with image and navigation
│   │   └── Sidebar.tsx          # Search, filters, and results list
│   ├── utils/
│   │   ├── csvParser.ts         # CSV data loading and parsing
│   │   └── filters.ts           # Filtering and sorting logic
│   ├── types.ts                 # TypeScript type definitions
│   ├── App.tsx                  # Main application component
│   └── main.tsx                 # Application entry point
├── public/
│   └── data/                    # Static data files (CSV and images)
├── data/                        # Source data folder
└── package.json
```

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Material-UI (MUI)** - Component library
- **React Router** - Navigation (ready for future use)
- **Vite** - Build tool and dev server
- **PapaParse** - CSV parsing

## Data Format

The application reads from `beefcut_init_database.csv` which contains:
- ID
- Name (English)
- Chinese Name
- Part (cut type)
- Lean (Yes/No)
- Approx. Price (range format)
- Rec. Cooking Methods
- Recommended Dishes
- Texture & Notes
- image reference

## Testing

Currently configured to use test data from images matching `beef_cut_r1*` pattern.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` folder.
