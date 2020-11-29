import ImgFormat from "./formats/img";
import PdfFormat from "./formats/pdf";
import ZipFormat from "./formats/zip";


export const supportedFormats = {
  "img": ImgFormat,
  "pdf": PdfFormat,
  "zip": ZipFormat,
};