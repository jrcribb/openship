export function openFrontOrderSearchWhere(searchEntry?: string): Record<string, unknown> {
  const normalizedSearch = searchEntry?.trim();
  if (!normalizedSearch) return {};

  const displayId = Number(normalizedSearch.replace(/^#/, ''));
  return {
    OR: [
      ...(Number.isSafeInteger(displayId) && displayId >= 0
        ? [{ displayId: { equals: displayId } }]
        : []),
      { email: { contains: normalizedSearch, mode: 'insensitive' } },
      {
        shippingAddress: {
          OR: [
            { firstName: { contains: normalizedSearch, mode: 'insensitive' } },
            { lastName: { contains: normalizedSearch, mode: 'insensitive' } },
          ],
        },
      },
    ],
  };
}
