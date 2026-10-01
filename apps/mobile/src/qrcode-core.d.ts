// `qrcode` ships types for its entry point only; the core encoder is imported directly (see QrCode.tsx).
declare module "qrcode/lib/core/qrcode" {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" },
  ): { modules: { size: number; get(row: number, col: number): boolean | number } };
}
