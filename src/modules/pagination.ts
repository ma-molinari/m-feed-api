export function paginationProps(limit: string, page: string) {
  const take = parseInt(limit) || 0;
  const skip = (parseInt(page) || 0) * take;

  return {
    take,
    skip,
  };
}
