import { useTranslation } from "react-i18next";
import Plus from "lucide-react/dist/esm/icons/plus";

type HomeProps = {
  onOpenProject: () => void;
};

export function Home({ onOpenProject }: HomeProps) {
  const { t } = useTranslation();

  return (
    <div className="home">
      <div className="home-content">
        <div className="home-hero">
          <h1 className="home-title">{t("home.welcome")}</h1>
          <p className="home-subtitle">{t("home.subtitle", "What would you like to build today?")}</p>

          <div className="home-hero-actions">
            <button
              className="home-primary-button"
              onClick={onOpenProject}
              data-tauri-drag-region="false"
            >
              <Plus size={20} />
              <span>{t("home.openProject")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
