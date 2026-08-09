declare module "ticalc-usb" {
  export type TIFile = {
    calcType: string;
    size: number;
    entries: Array<{
      name: string;
      size: number;
      type: number;
      data: Uint8Array;
      attributes?: { archived?: boolean; version?: number } | false;
    }>;
  };

  export type TICalculator = {
    name: string;
    status: string;
    isReady(): Promise<boolean>;
    canReceive(file: TIFile): boolean;
    getStorageDetails(file: TIFile): Promise<{ fits: boolean }>;
    sendFile(file: TIFile): Promise<void>;
  };

  export const ticalc: {
    browserSupported(): boolean;
    init(options?: { supportLevel?: string }): Promise<void>;
    choose(options?: { supportLevel?: string }): Promise<void>;
    addEventListener(
      event: "connect" | "disconnect",
      handler: (calculator: TICalculator) => void,
    ): void;
  };

  export const tifiles: {
    parseFile(bytes: Uint8Array): TIFile;
    isValid(file: TIFile): boolean;
  };

  const api: { ticalc: typeof ticalc; tifiles: typeof tifiles };
  export default api;
}
