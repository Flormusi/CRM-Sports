# CRM Sports

Proyecto full-stack (backend Express + Prisma y frontend React) con integración de tareas, WhatsApp, AFIP y gestión de inventario por lotes.

## Requisitos
- Node.js 18+
- Base de datos Postgres (o ajustá DATABASE_URL)
- Prisma CLI

## Variables de entorno
- Copiá `backend/.env.example` a `backend/.env` y completá valores
- Copiá `frontend/.env.example` a `frontend/.env.local` si usás CRA/React Scripts

## Desarrollo
### Backend
```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Seed de datos
- Cargar productos de El Nogal:
```bash
cd backend
npx ts-node prisma/seed_full.ts
```
- Cargar demo corta:
```bash
npx ts-node prisma/seed_products.ts
```

## Deploy
Ver `DEPLOY.md` para Railway/Vercel.

## Subir a GitHub
```bash
git init
git add .
git commit -m "Initial commit: CRM Sports"
git branch -M main
git remote add origin https://github.com/<tu_usuario>/CRM-Sports.git
git push -u origin main
```
