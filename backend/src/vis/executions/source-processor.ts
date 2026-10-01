/**
 * Source processor — page/stream records without loading millions into memory.
 */
export type PaginationStyle = 'PAGE' | 'OFFSET' | 'CURSOR' | 'NEXT_URL' | 'NONE';

export interface PageResult {
  items: Record<string, unknown>[];
  nextPage?: number | null;
  nextCursor?: string | null;
  nextUrl?: string | null;
  done: boolean;
}

export interface SourceReader {
  readPage(opts: {
    page?: number;
    cursor?: string | null;
    offset?: number;
    pageSize: number;
    path?: string;
  }): Promise<PageResult>;
}

export async function* paginateSource(
  reader: SourceReader,
  opts: {
    pageSize: number;
    style?: PaginationStyle;
    path?: string;
    maxPages?: number;
    /** Soft backpressure — wait and continue */
    shouldPause?: () => boolean;
    /** Hard stop — end pagination */
    shouldStop?: () => boolean;
  },
): AsyncGenerator<Record<string, unknown>[], void, unknown> {
  const style = opts.style || 'PAGE';
  let page = 1;
  let offset = 0;
  let cursor: string | null = null;
  let pages = 0;
  const maxPages = opts.maxPages ?? 10_000;

  while (pages < maxPages) {
    if (opts.shouldStop?.()) break;
    while (opts.shouldPause?.() && !opts.shouldStop?.()) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (opts.shouldStop?.()) break;
    const result = await reader.readPage({
      page: style === 'PAGE' ? page : undefined,
      offset: style === 'OFFSET' ? offset : undefined,
      cursor,
      pageSize: opts.pageSize,
      path: opts.path,
    });
    pages += 1;
    if (result.items.length) yield result.items;
    if (result.done || result.items.length === 0) break;

    if (style === 'PAGE') {
      page = result.nextPage ?? page + 1;
    } else if (style === 'OFFSET') {
      offset += opts.pageSize;
    } else if (style === 'CURSOR' || style === 'NEXT_URL') {
      cursor = result.nextCursor || result.nextUrl || null;
      if (!cursor) break;
    } else {
      break;
    }
  }
}
