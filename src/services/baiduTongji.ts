const BAIDU_TONGJI_SITE_ID = "daa60bcc45c658ee35054b93be3cf2e4";

declare global {
  interface Window {
    _hmt?: unknown[][];
  }
}

/**
 * 注入百度统计（PV/UV）脚本。
 * 仅生产构建生效，避免开发环境的访问污染统计数据。
 */
export function installBaiduTongji(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  window._hmt = window._hmt || [];
  const script = document.createElement("script");
  script.src = `https://hm.baidu.com/hm.js?${BAIDU_TONGJI_SITE_ID}`;
  script.async = true;
  document.head.appendChild(script);
}
