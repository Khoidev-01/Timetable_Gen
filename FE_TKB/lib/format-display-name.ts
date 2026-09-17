export function formatDisplayName(value?: string | null): string {
  const name = value?.trim() ?? '';
  if (!name) return '';

  return name.charAt(0).toLocaleUpperCase('vi-VN') + name.slice(1);
}
