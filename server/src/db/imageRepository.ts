/**
 * Image repository — the only place that touches the Image table.
 *
 * Pagination is keyset (cursor) on (createdAt, id) so pages stay stable under
 * concurrent inserts. Tags are stored as a JSON string for cross-DB support and
 * (de)serialized here.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { encodeCursor, decodeCursor } from "./cursor";

// eslint-disable-next-line @typescript-eslint/ban-types
export type ImageRecord = Prisma.ImageGetPayload<{}>;

/** Input shape for create(): Prisma fields, but tags come in as string[]. */
export type CreateImageInput = Omit<Prisma.ImageCreateInput, "tags"> & {
  tags?: string[];
};

export type SortOrder = "newest" | "oldest";

export interface ListQuery {
  limit: number;
  cursor?: string | null;
  category?: string;
  tag?: string;
  /** If omitted, no published filter is applied (admin view). */
  published?: boolean;
  sort?: SortOrder;
}

export interface ListResult {
  items: ImageRecord[];
  nextCursor: string | null;
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function serializeTags(tags?: string[] | null): string {
  return JSON.stringify((tags ?? []).map((t) => String(t)));
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function clampLimit(n: unknown): number {
  const num = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : DEFAULT_LIMIT;
  if (num <= 0) return DEFAULT_LIMIT;
  return Math.min(num, MAX_LIMIT);
}

export class ImageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateImageInput): Promise<ImageRecord> {
    return this.prisma.image.create({
      data: { ...data, tags: serializeTags(data.tags) },
    });
  }

  async findById(id: string): Promise<ImageRecord | null> {
    return this.prisma.image.findUnique({ where: { id } });
  }

  async findByContentHash(hash: string): Promise<ImageRecord | null> {
    return this.prisma.image.findUnique({ where: { contentHash: hash } });
  }

  async maxDisplayOrder(category?: string | null): Promise<number> {
    const agg = await this.prisma.image.aggregate({
      _max: { displayOrder: true },
      where: category ? { category } : undefined,
    });
    return agg._max.displayOrder ?? 0;
  }

  async count(filters: { category?: string; published?: boolean } = {}): Promise<number> {
    return this.prisma.image.count({
      where: {
        ...(filters.category ? { category: filters.category } : {}),
        ...(typeof filters.published === "boolean"
          ? { isPublished: filters.published }
          : {}),
      },
    });
  }

  async list(query: ListQuery): Promise<ListResult> {
    const limit = clampLimit(query.limit);
    const sort: SortOrder = query.sort === "oldest" ? "oldest" : "newest";
    const direction: "asc" | "desc" = sort === "oldest" ? "asc" : "desc";

    const where: Prisma.ImageWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(typeof query.published === "boolean"
        ? { isPublished: query.published }
        : {}),
      ...(query.tag
        ? // Tags are a JSON array string; match with a contains (cross-DB).
          { tags: { contains: JSON.stringify(query.tag) } }
        : {}),
    };

    const cursor = decodeCursor(query.cursor);
    const take = limit + 1; // fetch one extra to detect "hasMore"

    const rows = await this.prisma.image.findMany({
      where,
      orderBy: [{ createdAt: direction }, { id: direction }],
      ...(cursor
        ? { cursor: { createdAt_id: { createdAt: new Date(cursor.createdAt), id: cursor.id } }, skip: 1 }
        : {}),
      take,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

    return { items, nextCursor };
  }

  async update(
    id: string,
    data: Partial<Prisma.ImageUpdateInput> & { tags?: string[] }
  ): Promise<ImageRecord> {
    const { tags, ...rest } = data;
    const update: Prisma.ImageUpdateInput = { ...rest };
    if (tags !== undefined) update.tags = serializeTags(tags);
    return this.prisma.image.update({ where: { id }, data: update });
  }

  async delete(id: string): Promise<ImageRecord> {
    return this.prisma.image.delete({ where: { id } });
  }

  async deleteAll(): Promise<number> {
    const r = await this.prisma.image.deleteMany({});
    return r.count;
  }
}

export const paginationDefaults = { defaultLimit: DEFAULT_LIMIT, maxLimit: MAX_LIMIT };

/** Validate + coerce a pagination limit from request input. */
export function resolveLimit(input: unknown): number {
  return clampLimit(input);
}

/** Read tags off a stored record for the DTO layer. */
export function readTags(record: ImageRecord): string[] {
  return parseTags(record.tags);
}
