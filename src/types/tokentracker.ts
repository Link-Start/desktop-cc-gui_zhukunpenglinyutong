export type TtCliStatus = {
  installed: boolean;
  version: string | null;
  binPath: string | null;
};

export type TtServerStatus = {
  running: boolean;
  port: number;
};

export type TtInstallResult = {
  installed: boolean;
  version: string | null;
  binPath: string | null;
};
