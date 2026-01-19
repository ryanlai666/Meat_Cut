#!/bin/bash

# Google Drive API Test Script
# This script tests the Google Drive integration

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Google Drive API Test Script"
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

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Make sure GOOGLE_APPLICATION_CREDENTIALS is set or the key file is in the default location"
fi

# Check if key file exists
KEY_FILE="meat-buyer-guide-39a5081fce50-key.json"
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}Warning: Key file not found at $KEY_FILE${NC}"
    if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo "Using GOOGLE_APPLICATION_CREDENTIALS: $GOOGLE_APPLICATION_CREDENTIALS"
    else
        echo -e "${RED}Error: No Google credentials found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Running Google Drive API tests...${NC}"
echo ""

# Run the Node.js test script
node scripts/testGoogleDrive.js

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "All tests passed successfully!"
    echo "==========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "Tests failed with exit code: $TEST_EXIT_CODE"
    echo "==========================================${NC}"
    exit $TEST_EXIT_CODE
fi
