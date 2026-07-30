import { providerBrandIconNeedsDarkTile } from "../providerBrandIcon";

/**
 * 供应商品牌图标 <img> 统一渲染出口。
 * 白色主体字形的品牌(如 kimi)在浅色背景下不可见,自动加 .vendor-brand-icon-tile 深色底衬;
 * 尺寸仍由外层容器(.vendor-preset-btn-icon / .vendor-card-icon)的 img 规则控制。
 */
export function ProviderBrandIconImg({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className={
        providerBrandIconNeedsDarkTile(src)
          ? "vendor-brand-icon-tile"
          : undefined
      }
    />
  );
}
