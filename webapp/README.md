# CofiBlocks Webapp

Next.js frontend application for the CofiBlocks marketplace.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

The application will start on `http://localhost:3000`

## Build

To build for production:
```bash
npm run build
npm start
```

## Features

- **Landing Page**: Marketplace with product grid
- **Search**: Search products by name or region
- **Filters**: Filter by region, roast level, price range, and grind type
- **Responsive Design**: Mobile-first responsive layout with TailwindCSS
- **TypeScript**: Full type safety throughout the application

## API Integration

The frontend connects to the server API at `http://localhost:4000/api/products`. Make sure the server is running before starting the frontend

