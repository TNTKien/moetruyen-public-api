export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const normalizePage = (value: number | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE;
  }

  return Math.max(DEFAULT_PAGE, Math.trunc(value));
};

export const normalizeLimit = (value: number | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
};

export const getPaginationMeta = ({ page, limit }: PaginationInput, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});
