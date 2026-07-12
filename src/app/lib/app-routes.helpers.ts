import { createBrowserRouter, createHashRouter, type RouteObject } from "react-router-dom";

export function shouldUseHashRouter(protocol = typeof window !== "undefined" ? window.location.protocol : ""): boolean {
  return protocol === "file:";
}

export function createAppRouter(routes: RouteObject[]) {
  return shouldUseHashRouter() ? createHashRouter(routes) : createBrowserRouter(routes);
}
