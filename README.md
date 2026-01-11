This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm build
# and
pnpm dev
# and
pnpm worker
```

Open [http://localhost:3005](http://localhost:3005) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Database Management

### Reset Database

To completely reset the database (delete all users, messages, tags, etc.):

```bash
# 1. Drop the existing database
docker exec pg16 psql -U myuser -d postgres -c "DROP DATABASE IF EXISTS whitenote;"

# 2. Create a fresh database
docker exec pg16 psql -U myuser -d postgres -c "CREATE DATABASE whitenote;"

# 3. Push the Prisma schema
pnpm prisma db push

# 4. Run seed script (creates default user, templates, tags)
pnpm prisma db seed
```

**⚠️ Warning**: This will permanently delete all data in the database. Make sure to backup any important data before resetting.

### Database Operations

```bash
# Push schema changes to database
pnpm prisma db push

# Run seed script (creates default user, templates, tags)
pnpm prisma db seed

# Seed AI commands only
pnpm seed:ai-commands

# Open Prisma Studio (database UI)
pnpm prisma studio

# Generate Prisma client
pnpm prisma generate
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
