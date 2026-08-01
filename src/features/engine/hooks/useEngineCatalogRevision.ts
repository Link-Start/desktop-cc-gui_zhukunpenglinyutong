import { useEffect, useState } from "react";
import { isEngineCatalogStorageKey } from "./engineControllerCatalog";

export function useEngineCatalogRevision() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (isEngineCatalogStorageKey(event.key)) {
        setRevision((value) => value + 1);
      }
    };
    const handleCustomStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (isEngineCatalogStorageKey(customEvent.detail?.key)) {
        setRevision((value) => value + 1);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("localStorageChange", handleCustomStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "localStorageChange",
        handleCustomStorageChange,
      );
    };
  }, []);

  return revision;
}
