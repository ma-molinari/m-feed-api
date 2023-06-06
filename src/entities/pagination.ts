interface PaginationProps<T = {}> {
  Querystring: {
    limit: string;
    start: string;
  } & T;
}

export type { PaginationProps };
