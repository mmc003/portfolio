/**
 * Prisma client. Exposed as a factory (tests inject a specific datasourceUrl)
 * and a cached singleton for the running app.
 */
import { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env";
import { ImageRepository } from "./imageRepository";

export function createPrismaClient(datasourceUrl?: string): PrismaClient {
  const url = datasourceUrl ?? getEnv().DATABASE_URL;
  return new PrismaClient({
    datasourceUrl: url,
    log: getEnv().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let cached: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!cached) cached = createPrismaClient();
  return cached;
}

/** Reset the cache (tests). */
export function resetPrismaCache(): void {
  cached = undefined;
}

let repoCached: ImageRepository | undefined;

/** Singleton image repository backed by the shared Prisma client. */
export function getRepo(): ImageRepository {
  if (!repoCached) repoCached = new ImageRepository(getPrismaClient());
  return repoCached;
}

export function resetRepoCache(): void {
  repoCached = undefined;
}
