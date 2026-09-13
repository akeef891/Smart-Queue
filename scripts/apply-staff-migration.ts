import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const sqlPath = path.join(__dirname, "../prisma/add_staff_members.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("Applying staff & roles migration...");
  await prisma.$executeRawUnsafe(sql);
  console.log("✓ Migration applied successfully!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
