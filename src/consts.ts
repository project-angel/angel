import ZipFormat from "./formats/zip";
import ImgFormat from "./formats/img";
import PdfFormat from "./formats/pdf";

export const defaultFormat : keyof typeof supportedFormats = "zip";
export const supportedFormats = {
  "zip": ZipFormat,
  "img": ImgFormat,
  "pdf": PdfFormat
};