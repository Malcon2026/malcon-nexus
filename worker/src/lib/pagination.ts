const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export type PageParams = {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function parsePagination(url: URL): PageParams | { error: string } {
  const pageRaw = url.searchParams.get('page');
  const sizeRaw = url.searchParams.get('pageSize') ?? url.searchParams.get('limit');

  const page = pageRaw == null ? DEFAULT_PAGE : Number(pageRaw);
  const pageSize = sizeRaw == null ? DEFAULT_PAGE_SIZE : Number(sizeRaw);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'Invalid page (must be integer >= 1)' };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return { error: 'Invalid pageSize (must be integer >= 1)' };
  }
  if (pageSize > MAX_PAGE_SIZE) {
    return { error: `pageSize must not exceed ${MAX_PAGE_SIZE}` };
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
