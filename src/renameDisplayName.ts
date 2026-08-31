export function renameValueForHost(
  editValue: string,
  isOrdable: boolean,
  isWithProject: boolean,
): string {
  if (!isOrdable || isWithProject) return editValue;
  return editValue.replace(/^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/, "$1");
}
