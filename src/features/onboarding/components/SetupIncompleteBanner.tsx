import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isClientStoreReady,
  subscribeClientStoreHydrated,
} from "../../../services/clientStorage";
import {
  FIRST_RUN_SETUP_CHANGE_EVENT,
  requestFirstRunSetupReopen,
} from "../utils/setupEvents";
import {
  readFirstRunSetupProfile,
  shouldOfferSetupBanner,
} from "../utils/setupGate";

export function SetupIncompleteBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const refresh = () => {
      if (!isClientStoreReady("app")) {
        setVisible(false);
        return;
      }
      setVisible(shouldOfferSetupBanner(readFirstRunSetupProfile()));
    };
    refresh();
    const unsubscribe = subscribeClientStoreHydrated((store) => {
      if (store === "app") {
        refresh();
      }
    });
    window.addEventListener(FIRST_RUN_SETUP_CHANGE_EVENT, refresh);
    return () => {
      unsubscribe();
      window.removeEventListener(FIRST_RUN_SETUP_CHANGE_EVENT, refresh);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="first-run-banner" data-testid="first-run-setup-banner">
      <p>{t("onboarding.banner.message")}</p>
      <button
        type="button"
        className="first-run-banner-action"
        onClick={() => requestFirstRunSetupReopen({ step: "cli" })}
      >
        {t("onboarding.banner.action")}
      </button>
    </div>
  );
}
