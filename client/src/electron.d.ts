interface Window {
  electronAPI?: {
    readonly isElectron: true;
    getVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void;
  };
}
