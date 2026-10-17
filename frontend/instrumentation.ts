export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrationsOrExit } = await import("@/lib/db/migrate");
  await runMigrationsOrExit();
}
