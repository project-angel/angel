import {Details, OutputFile, SingleFormat} from "../typedefs";
import imagesToPdf from "images-to-pdf";
import * as fs from "fs";
import * as path from "path";
import tempDirectory from "temp-dir";
import {warn} from "../util/log";

const pdfs : { [key : string]: { path: string, images: { [key : number] : string } } } = {};

/**
 * Exports the doujin in a PDF format
 *
 * @author ProjectAngelAuthor
 */
const PdfFormat : SingleFormat = {
  single: true,
  cleanup({ doujin}): void {
    const targetPath = path.resolve(tempDirectory, `project-angel-${doujin.doujinId}`);
    if (fs.existsSync(targetPath))
      fs.rmdirSync(targetPath, { recursive: true });
  },
  preDownload({ doujin }): void | Promise<void> {
    // Get a spot in a temporary folder somwhere.
    const targetPath = path.resolve(tempDirectory, `project-angel-${doujin.doujinId}`);
    if (!fs.existsSync(targetPath))
      fs.mkdirSync(targetPath, { recursive: true });

    pdfs[doujin.doujinId] = {path: targetPath, images: []};
  },
  async postDownload({ downloadInfo, doujin }: Details): Promise<OutputFile> {
    let outputLocation = downloadInfo.correctExtension ?
      (downloadInfo.output.endsWith(".pdf") ?
        downloadInfo.output : `${downloadInfo.output}.pdf`) : downloadInfo.output;

    const sortedImages = {};
    Object.keys(pdfs[doujin.doujinId].images).sort().forEach(function(key) {
      sortedImages[key] = pdfs[doujin.doujinId].images[key];
    })
    imagesToPdf(Object.values(sortedImages), outputLocation);

    // Success!
    return {
      format: PdfFormat,
      path: outputLocation
    }
  },
  skipPage({ doujin }, image) : boolean {
    if (!/^(?:png|jpe?g)$/.test(image.extension)) {
      warn(`Unsupported file extension for page ${image.pageNumber}: "${image.extension}". Skipping...`);
      return true;
    }

    const pagePath = path.join(pdfs[doujin.doujinId].path, `${image.pageNumber}.${image.extension}`);
    if (fs.existsSync(pagePath)) {
      pdfs[doujin.doujinId].images[image.pageNumber] = pagePath;
      return true;
    } return false;
  },
  onPage({ doujin }, image): void | Promise<void> {
    // Save the image into the folder
    const outputFile = path.join(pdfs[doujin.doujinId].path, `${image.pageNumber}.${image.extension}`);
    fs.writeFileSync(outputFile, image.data);
    pdfs[doujin.doujinId].images[image.pageNumber] = outputFile;
  }
}

export default PdfFormat;