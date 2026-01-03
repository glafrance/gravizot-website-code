export const sortObjectByProperty = <T>(
  arr: T[],
  property: keyof T
): T[] => {
  return arr?.sort((a, b) =>
    (a?.[property] ?? "").toString().localeCompare(
      (b?.[property] ?? "").toString(),
      "en",
      { sensitivity: "base" }
    )
  );
};
