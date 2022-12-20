// must be the first import
import "./prisma-export-patch.server";

import fs from "fs";

import type { Prisma } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { runMigrations } from "graphile-worker";
import { Client as PgClient } from "pg";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";
import "process";

const DB_HOST = process.env.DB_HOST ?? "localhost";

export const provideDb = (
  testFn: (db: Prisma.NonTransactionClient) => Promise<void>,
): (() => Promise<void>) => {
  return async () => {
    const dbName = uuidv4();
    const dbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${dbName}`;
    const db = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    const schemaPath = `prisma/tmp-${dbName}.prisma`;
    const schemaContents = fs
      .readFileSync("prisma/schema.prisma")
      .toString()
      .replace(`env("PRISMA_DATABASE_URL")`, `"${dbUrl}"`);
    fs.writeFileSync(schemaPath, schemaContents);

    await build.ensureDatabaseExists("apply", true, schemaPath);
    const migrate = new build.Migrate(schemaPath);

    // eslint-disable-next-line no-console
    console.info = () => {};
    await migrate.applyMigrations();
    fs.unlinkSync(schemaPath);

    migrate.stop();

    await runMigrations({ connectionString: dbUrl });

    let error = null;
    try {
      await testFn(db);
    } catch (err) {
      error = err;
    }
    await db.$disconnect();

    const pgClient = new PgClient({
      user: "postgres",
      password: "pass",
      host: DB_HOST,
      port: 5432,
    });
    const query = `DROP DATABASE "${dbName}";`;
    await pgClient.connect();
    await pgClient.query(query);
    await pgClient.end();

    if (error != null) {
      throw error;
    }
  };
};
