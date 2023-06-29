interface Query {
  Querystring: {
    limit: string;
    page: string;
  };
}

type PaginationProps<T = {}> = Query & T;

export type { PaginationProps };
