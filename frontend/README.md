This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `OPENROUTER_API_KEY` | for AI chat | Server-side key used by `app/api/chat/route.ts`. Without it the chat panel returns a "not configured" message and the rest of the app works normally. |
| `NEXT_PUBLIC_SHORTENER_BASE_URL` | no | Overrides the link shortener used by Share. Defaults to `https://short.akbarakma.com`. |

`OPENROUTER_API_KEY` is **never** exposed to the browser — do not add a
`NEXT_PUBLIC_` prefix. Locally it goes in `.env.local`; in Docker it goes in a
`.env` next to `compose.yaml`, which Compose substitutes into the container
environment. Both are excluded by `.gitignore` and `.dockerignore`.

The chat route calls `deepseek/deepseek-v4-pro` through OpenRouter with the
provider pinned to DeepSeek (`allow_fallbacks: false`) and reasoning disabled
(`reasoning: { effort: "none" }`). There is no rate limiting, so use a dedicated
key with a credit limit set on it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
