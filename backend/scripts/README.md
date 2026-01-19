# Google Drive Integration Scripts

This directory contains scripts for testing and managing Google Drive integration.

## Scripts

### 1. `testGoogleDrive.sh` / `testGoogleDrive.js`

Tests all Google Drive API functionality including:
- Service initialization
- File listing
- Image upload
- Image download
- Image update
- Image deletion

**Usage:**
```bash
# Using bash script (Linux/Mac/Git Bash)
./scripts/testGoogleDrive.sh

# Using npm script
npm run test:drive

# Direct Node.js execution
node scripts/testGoogleDrive.js
```

### 2. `testApiEndpoints.sh`

Tests HTTP API endpoints for the meat cut application.

**Usage:**
```bash
# Set API base URL (optional, defaults to http://localhost:5000)
export API_BASE_URL=http://localhost:5000

# Set admin API key (optional, for admin endpoints)
export ADMIN_API_KEY=your_api_key

# Run tests
./scripts/testApiEndpoints.sh
```

**Note:** Make sure the server is running before executing this script.

### 3. `uploadExistingImages.sh` / `uploadExistingImages.js`

Uploads all existing meat cut images from the local `data/beef_cuts_images` directory to Google Drive and updates the database with Google Drive file IDs and URLs.

**Usage:**
```bash
# Using bash script (Linux/Mac/Git Bash)
./scripts/uploadExistingImages.sh

# Using npm script
npm run upload:images

# Direct Node.js execution
node scripts/uploadExistingImages.js
```

## Prerequisites

1. **Google Service Account Key**: 
   - Place your service account key file at `backend/meat-buyer-guide-39a5081fce50-key.json`
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file

2. **Environment Variables** (optional):
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./path/to/key.json
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id  # Optional: use existing folder
   GOOGLE_DRIVE_FOLDER_NAME=meat-cut-images  # Optional: folder name (default: meat-cut-images)
   ```

3. **Database**: Make sure the database is initialized and contains meat cut data

## Security Notes

- The key file (`*-key.json`) is automatically ignored by git (see `.gitignore`)
- Never commit service account keys to version control
- Use environment variables for sensitive configuration in production

## Troubleshooting

### "Failed to initialize Google Drive"
- Check that the key file exists and is valid
- Verify the service account has Drive API access enabled
- Ensure the service account has proper permissions

### "Folder not found" or "Permission denied"
- The service account needs access to create folders in Google Drive
- Share the target folder with the service account email if using an existing folder

### Rate Limiting
- Google Drive API has rate limits
- The upload script includes small delays between uploads
- If you encounter rate limit errors, increase the delay in `uploadExistingImages.js`
