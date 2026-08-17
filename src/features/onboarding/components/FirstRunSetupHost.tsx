import { FirstRunSetupWizard } from "./FirstRunSetupWizard";
import { useFirstRunSetup } from "../hooks/useFirstRunSetup";

export function FirstRunSetupHost() {
  const setup = useFirstRunSetup();
  if (setup.pendingOverlay && !setup.visible) {
    return <div className="first-run-setup" aria-hidden data-testid="first-run-setup-pending" />;
  }
  if (!setup.visible) {
    return null;
  }

  return (
    <FirstRunSetupWizard
      profile={setup.profile}
      step={setup.profile.step}
      onStepChange={setup.handleStepChange}
      onIdeChange={setup.handleIdeChange}
      selectedEngine={setup.selectedEngine}
      onSelectEngine={setup.setSelectedEngine}
      engineStatuses={setup.engineStatuses}
      cardStateByEngine={setup.cardStateByEngine}
      onInstall={(engine) => {
        void setup.handleInstall(engine);
      }}
      detecting={setup.detecting}
      onContinueFromWelcome={setup.handleContinueFromWelcome}
      onSkipCli={setup.handleSkipCli}
      onEnterApp={setup.handleEnterApp}
    />
  );
}
