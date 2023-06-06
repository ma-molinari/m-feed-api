export function paginationProps(limit: string, start: string) {
  const take = parseInt(limit) || 0;
  const skip = (parseInt(start) || 0) * take;

  return {
    take,
    skip,
  };
}
