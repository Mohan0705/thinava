# Thinava - Food Delivery Platform

A modern, production-ready hyperlocal food delivery platform for Tadepalligudem, Andhra Pradesh.

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Zustand
- **Backend**: Express.js, PostgreSQL, JWT authentication
- **PWA**: Full Progressive Web App support

## Installation

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### Database
```bash
createdb thinava
psql -d thinava -f server/src/database/schema.sql
```

## Features
- Restaurant discovery with categories and filters
- Full menu system with images
- Smart cart with quantity management
- OTP-based authentication
- Order tracking with real-time status
- User profile with address management
- PWA with offline support
- Admin dashboard for restaurant/order management

## API Endpoints
- `/api/auth` - Authentication (OTP login)
- `/api/restaurants` - Restaurant management
- `/api/menu` - Menu items
- `/api/orders` - Order management
- `/api/users` - User profiles and addresses

## Deployment
- Frontend: Vercel
- Backend: Render/Railway
- Database: Supabase/Neon

## License
Proprietary software. All rights reserved.
