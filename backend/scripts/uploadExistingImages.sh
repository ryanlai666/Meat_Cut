#!/bin/bash

# Upload Existing Images to Google Drive
# This script uploads all existing meat cut images to Google Drive

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Upload Existing Images to Google Drive"
echo "=========================================="
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed or not in PATH${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}Warning: package.json not found. Changing to backend directory...${NC}"
    cd backend || exit 1
fi

# Check if images directory exists
IMAGES_DIR="../data/beef_cuts_images"
if [ ! -d "$IMAGES_DIR" ]; then
    echo -e "${RED}Error: Images directory not found at $IMAGES_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}Starting image upload process...${NC}"
echo "Images directory: $IMAGES_DIR"
echo ""

# Run the Node.js upload script
node scripts/uploadExistingImages.js

UPLOAD_EXIT_CODE=$?

if [ $UPLOAD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "Image upload completed successfully!"
    echo "==========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "Image upload failed with exit code: $UPLOAD_EXIT_CODE"
    echo "==========================================${NC}"
    exit $UPLOAD_EXIT_CODE
fi
