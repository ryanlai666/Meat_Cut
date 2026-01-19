#!/bin/bash

# API Endpoints Test Script
# This script tests the HTTP API endpoints for Google Drive integration

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:5000}"
API_KEY="${ADMIN_API_KEY:-}"

echo "=========================================="
echo "API Endpoints Test Script"
echo "=========================================="
echo ""
echo "API Base URL: $API_BASE_URL"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local expected_status=$5
    
    if [ -z "$expected_status" ]; then
        expected_status=200
    fi
    
    echo -e "${BLUE}Testing: $description${NC}"
    echo "  $method $endpoint"
    
    local response
    local status_code
    
    if [ "$method" = "GET" ]; then
        if [ -n "$API_KEY" ]; then
            response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: $API_KEY" "$API_BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint")
        fi
    elif [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        if [ -n "$API_KEY" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -H "X-API-Key: $API_KEY" \
                -d "$data" \
                "$API_BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_BASE_URL$endpoint")
        fi
    elif [ "$method" = "DELETE" ]; then
        if [ -n "$API_KEY" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "X-API-Key: $API_KEY" \
                "$API_BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                "$API_BASE_URL$endpoint")
        fi
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✓ Passed (Status: $status_code)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "  Response: $(echo "$body" | head -c 100)..."
        fi
    else
        echo -e "  ${RED}✗ Failed (Expected: $expected_status, Got: $status_code)${NC}"
        echo "  Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: Health check
test_endpoint "GET" "/api/health" "Health Check" "" 200

# Test 2: Metadata endpoint
test_endpoint "GET" "/api/metadata" "Get Metadata" "" 200

# Test 3: Search endpoint
test_endpoint "GET" "/api/meat-cuts/search?q=chuck" "Search Meat Cuts" "" 200

# Test 4: Get filters
test_endpoint "GET" "/api/filters/options" "Get Filter Options" "" 200

# Test 5: Get single meat cut by slug (if available)
# First, try to get a list to find a slug
echo -e "${BLUE}Finding a meat cut slug for testing...${NC}"
search_response=$(curl -s "$API_BASE_URL/api/meat-cuts/search?limit=1")
slug=$(echo "$search_response" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$slug" ]; then
    test_endpoint "GET" "/api/meat-cuts/$slug" "Get Meat Cut by Slug" "" 200
    test_endpoint "GET" "/api/meat-cuts/$slug/image" "Get Meat Cut Image" "" 200
else
    echo -e "${YELLOW}  ⚠ No meat cuts found, skipping slug tests${NC}"
    echo ""
fi

# Test 6: Admin endpoints (if API key is provided)
if [ -n "$API_KEY" ]; then
    echo -e "${BLUE}Testing Admin Endpoints...${NC}"
    test_endpoint "GET" "/api/admin/meat-cuts?limit=5" "List Meat Cuts (Admin)" "" 200
    test_endpoint "GET" "/api/admin/cooking-methods" "List Cooking Methods" "" 200
    test_endpoint "GET" "/api/admin/recommended-dishes" "List Recommended Dishes" "" 200
else
    echo -e "${YELLOW}Skipping admin endpoints (ADMIN_API_KEY not set)${NC}"
    echo ""
fi

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
