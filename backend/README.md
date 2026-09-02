# CofiBlocks Server

REST API server for the CofiBlocks application built with Node.js and Express.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:4000`

## Build

To build for production:
```bash
npm run build
npm start
```

## API Endpoints

### GET /api/products

Returns a list of products with optional filtering.

**Query Parameters:**
- `search` (string, optional): Search by product name or region
- `region` (string, optional): Filter by region (e.g., "Ethiopia", "Colombia")
- `roastLevel` (string, optional): Filter by roast level (e.g., "Light", "Medium", "Dark")
- `minPrice` (number, optional): Minimum price filter
- `maxPrice` (number, optional): Maximum price filter
- `grindType` (string, optional): Filter by grind type ("ground" or "whole")

**Example:**
```
GET /api/products?region=Ethiopia&roastLevel=Light&minPrice=20&maxPrice=30
```

**Response:**
```json
[
  {
    "id": "1",
    "name": "Ethiopian Yirgacheffe",
    "region": "Ethiopia",
    "roastLevel": "Light",
    "price": 24.99,
    "grindType": "whole",
    "imageUrl": "https://..."
  }
]
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

