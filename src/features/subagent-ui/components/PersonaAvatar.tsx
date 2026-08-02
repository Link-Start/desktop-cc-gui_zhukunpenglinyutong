import { memo, useState, type MouseEvent } from "react";
import { AgentIcon } from "../../../components/AgentIcon";
import { cn } from "@/lib/utils";

type PersonaAvatarProps = {
  displayName: string;
  avatarSrc?: string | null;
  githubProfileUrl?: string | null;
  size?: number;
  className?: string;
};

/**
 * 作者头像：优先本地/GitHub 图；失败回退 AgentIcon。
 * 有 GitHub 主页时头像可点，外链浏览器打开（阻止冒泡以免点卡片）。
 */
export const PersonaAvatar = memo(function PersonaAvatar({
  displayName,
  avatarSrc = null,
  githubProfileUrl = null,
  size = 32,
  className,
}: PersonaAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarSrc) && !imageFailed;

  const body = showImage ? (
    <img
      src={avatarSrc ?? undefined}
      alt=""
      width={size}
      height={size}
      className="subagent-persona-avatar-img"
      draggable={false}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <AgentIcon seed={displayName} size={Math.max(14, Math.round(size * 0.55))} className="inline-flex" />
  );

  const shellClass = cn("subagent-persona-avatar", className);

  if (githubProfileUrl) {
    return (
      <a
        className={cn(shellClass, "is-link")}
        href={githubProfileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${displayName} · GitHub`}
        aria-label={`Open ${displayName} on GitHub`}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
        }}
        style={{ width: size, height: size }}
      >
        {body}
      </a>
    );
  }

  return (
    <span className={shellClass} aria-hidden style={{ width: size, height: size }}>
      {body}
    </span>
  );
});
