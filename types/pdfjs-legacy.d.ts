declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  type TextItem = { str?: string };
  type PdfPage = {
    getTextContent: () => Promise<{ items: TextItem[] }>;
  };
  type PdfDocument = {
    numPages: number;
    getPage: (n: number) => Promise<PdfPage>;
    destroy: () => Promise<void>;
  };
  export function getDocument(params: {
    data: Uint8Array;
    isEvalSupported?: boolean;
    disableFontFace?: boolean;
    useSystemFonts?: boolean;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
  }): { promise: Promise<PdfDocument> };
}
