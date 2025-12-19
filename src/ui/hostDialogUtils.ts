export function isHostDialogWindow(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("hostDialog") === "true" || window.location.hash.includes("hostDialog=true");
}
