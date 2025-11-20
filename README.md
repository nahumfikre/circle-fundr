# CircleFundr

CircleFundr is a full-stack web application designed for clubs, fraternities, and friend groups to organize subgroups (“circles”), manage shared expenses, and streamline payments. Members join workspaces, create circles for specific events or trips, and split costs through individual payment events. The platform includes authentication, workspace and circle management, a relational data model, and Stripe Checkout integration for secure payments.

---

## Features

### Workspace & Membership Management
- Users can create or join workspaces (e.g., clubs, fraternities).
- Each workspace includes members with role-based access control (Admin / Member).

### Circles (Subgroups)
- Circles represent smaller groups within a workspace (e.g., “Spring Break 2025”).
- Circles inherit workspace membership and include their own members and events.

### Payment Events
- Payment events allow circle members to split shared costs such as housing, rentals, tickets, etc.
- Each event generates payment obligations for all members of the circle.

### Stripe Checkout Integration
- Members can pay their portion via Stripe Checkout.
- Payment status updates automatically (manual admin override also included).
- Each payment is associated with a member's membership record and the event.

### Authentication & Authorization
- JWT-based login and registration.
- Protected backend routes.
- Persistent user sessions stored client-side.

### Modern Full-Stack Architecture
- Frontend: Next.js 14 (App Router), TypeScript, React, TailwindCSS
- Backend: Node.js, Express, TypeScript
- ORM / Database: Prisma ORM with PostgreSQL
- Payments: Stripe Checkout Sessions
- Clear routing structure with separation of concerns between API, auth, workspaces, circles, memberships, and payments.

---

## Tech Stack

**Frontend**
- Next.js 14
- TypeScript
- React
- TailwindCSS

**Backend**
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Stripe SDK
- JWT Authentication

**Infrastructure**
- Railway PostgreSQL (development)
- Local Node.js backend

---

## Project Structure

circlefundr/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   ├── prisma/
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── app/
    ├── components/
    ├── public/
    ├── package.json
    └── tsconfig.json

---

## Getting Started

### 1. Clone the Repository
git clone https://github.com/nahumfikre/circlefundr.git
cd circlefundr

---

# Backend Setup

### 2. Install Dependencies
cd backend
npm install

### 3. Create a .env File
Create backend/.env with the following:

DATABASE_URL=<your-postgres-url>
JWT_SECRET=<your-jwt-secret>
PORT=4000
STRIPE_SECRET_KEY=<your-stripe-secret-key>
FRONTEND_URL=http://localhost:3000

Ensure .env is listed in .gitignore.

### 4. Run Database Migrations
npx prisma migrate dev

### 5. Start the Backend Server
npm run dev

Backend runs at:
http://localhost:4000

---

# Frontend Setup

### 6. Install Dependencies
cd ../frontend
npm install

### 7. Start the Frontend
npm run dev

Frontend runs at:
http://localhost:3000

---

## Stripe Test Mode

This project uses Stripe Checkout in test mode.

To test payments:
1. Open a payment event page.
2. Click “Pay with card”.
3. Use Stripe’s test card:

4242 4242 4242 4242  
Any future expiration  
Any CVC  
Any ZIP code  

The payment will complete without charging a real card.

---

## Development Notes
- Authentication uses JWT stored in localStorage.
- All backend routes require Authorization: Bearer <token>.
- Prisma is configured with PostgreSQL using DATABASE_URL.
- Stripe payment records store:
  - Payment amount
  - Status (PENDING, PAID)
  - Stripe session ID
  - Associated user, event, and membership IDs

---

## Future Improvements
- Stripe webhooks for automatic payment confirmation
- Admin dashboard for pooled funds and payout reporting
- Role-based UI views
- Email notifications for invites and payments
- Workspace analytics for total dues and outstanding balances
- Improved membership management UI

---
