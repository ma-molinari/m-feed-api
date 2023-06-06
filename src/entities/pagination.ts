interface PaginationProps<T = {}> {
  Querystring: {
    limit: string;
    page: string;
  } & T;
}

export type { PaginationProps };
