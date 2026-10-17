# md-view

Visit the site: [https://md.akbarakma.com](https://md.akbarakma.com)

## Share links and AI agents

Share stores the document on the server and copies a link like `https://md.akbarakma.com/d/AbCdE12345`. Shared documents never change after creation.

- Raw Markdown: `GET https://md.akbarakma.com/d/{id}.md`
- Create: `POST https://md.akbarakma.com/api/documents` with `{"markdown": "..."}`
- MCP server (Streamable HTTP, no auth): `https://md.akbarakma.com/mcp`, tools `create_document` and `read_document`

Connect Claude Code:

```bash
claude mcp add --transport http md-view https://md.akbarakma.com/mcp
```

Limits: 10 MB per request (nginx), 30 creates per hour and 100 per day for each IP.

## Local development

The app needs Postgres. Migrations in `frontend/drizzle/` run when the server starts.

```bash
docker run -d --name md-view-dev-postgres -e POSTGRES_DB=md_view -e POSTGRES_USER=md_view \
  -e POSTGRES_PASSWORD=devpass -p 127.0.0.1:55432:5432 postgres:16-alpine
cd frontend
DATABASE_URL=postgresql://md_view:devpass@127.0.0.1:55432/md_view npm run dev
```

After changing `lib/db/schema.ts`, run `npx drizzle-kit generate --name <change>` and commit the new file in `drizzle/`.

Production reads `POSTGRES_PASSWORD` from `frontend/.env` next to `compose.yaml`.
