import type { AppNavigationItem } from "../model";

export function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === "/") {
    return currentPath === "/";
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function isNavItemActive(currentPath: string, item: AppNavigationItem): boolean {
  return isActivePath(currentPath, item.path) || Boolean(item.activePaths?.some((path) => isActivePath(currentPath, path)));
}
