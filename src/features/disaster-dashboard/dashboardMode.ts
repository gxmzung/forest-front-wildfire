export function isExplicitDashboardDemo(search: string) {
  return new URLSearchParams(search).get("demo") === "1";
}
