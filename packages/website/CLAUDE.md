# Website — vibeannotations.com

Next.js 15 marketing site with Tailwind CSS. Deployed on Vercel from `packages/website/`.

## Commands

```bash
pnpm dev:web        # from repo root
pnpm build:web      # production build
# or from this directory:
pnpm dev
pnpm build
```

## Structure

```
src/
  app/          Next.js App Router pages
    page.tsx    Landing page
    terms/      Terms of service
  components/   React components
  data/         Static data / content
  fonts/        Local font files
  styles/       Global CSS
public/         Static assets
```

## Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 3
- **Animations**: Framer Motion
- **Icons**: @iconify/react
- **Analytics**: @vercel/analytics
- **Deploy**: Vercel — root directory set to `packages/website`

## Vercel config

`vercel.json` lives in this directory. Ignored Build Step should skip deploys when only the extension changes:
```bash
git diff HEAD^ HEAD --quiet -- packages/website/ || exit 1
```
