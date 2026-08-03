/**
 * 本地打包的 GitHub 头像（下载自 github.com/{login}.png）。
 * 事实源：zhukunpenglinyutong/desktop-cc-gui contributors。
 */
import avatarChenxiangning from "../../../assets/persona-avatars/chenxiangning.png";
import avatarZhukunpenglinyutong from "../../../assets/persona-avatars/zhukunpenglinyutong.png";
import avatarGodilley from "../../../assets/persona-avatars/godilley.png";
import avatarWatsonctl from "../../../assets/persona-avatars/watsonctl.png";
import avatarAlphaCatMeow from "../../../assets/persona-avatars/AlphaCatMeow.png";
import avatarHpstream from "../../../assets/persona-avatars/hpstream.png";
import avatarJuddd from "../../../assets/persona-avatars/Juddd.png";
import avatarZhanghangdr from "../../../assets/persona-avatars/zhanghangdr.png";
import avatarYoucaizhang from "../../../assets/persona-avatars/youcaizhang.png";
import avatarJunxin367 from "../../../assets/persona-avatars/junxin367.png";

export const PERSONA_AVATAR_ASSETS: Readonly<Record<string, string>> = {
  chenxiangning: avatarChenxiangning,
  zhukunpenglinyutong: avatarZhukunpenglinyutong,
  godilley: avatarGodilley,
  watsonctl: avatarWatsonctl,
  AlphaCatMeow: avatarAlphaCatMeow,
  hpstream: avatarHpstream,
  Juddd: avatarJuddd,
  zhanghangdr: avatarZhanghangdr,
  youcaizhang: avatarYoucaizhang,
  junxin367: avatarJunxin367,
};

export function resolveLocalPersonaAvatarSrc(avatarKey: string | null | undefined): string | null {
  if (!avatarKey) {
    return null;
  }
  return PERSONA_AVATAR_ASSETS[avatarKey] ?? null;
}
