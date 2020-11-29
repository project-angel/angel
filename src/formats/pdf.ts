import {Details, OutputFile, SingleFormat} from "../typedefs";
import imagesToPdf from "images-to-pdf";
import * as fs from "fs";
import * as path from "path";
import tempDirectory from "temp-dir";
import chalk from "chalk";

const pdfs : { [key : string]: { path: string, images: string[] } } = {};

/**
 * Exports the doujin in a PDF format
 *
 * @author ProjectAngelAuthor
 */
const PdfFormat : SingleFormat = {
  single: true,
  preDownload({ doujin }): void | Promise<void> {
    // Get a spot in a temporary folder somwhere.
    const targetPath = path.resolve(tempDirectory, `project-angel-${doujin.doujinId}`);
    if (fs.existsSync(targetPath))
      fs.rmdirSync(targetPath, { recursive: true });

    fs.mkdirSync(targetPath, { recursive: true });

    pdfs[doujin.doujinId] = {path: targetPath, images: []};
  },
  async postDownload({ downloadInfo, doujin }: Details): Promise<OutputFile> {
    let outputLocation = downloadInfo.correctExtension ?
      (downloadInfo.output.endsWith(".pdf") ?
        downloadInfo.output : `${downloadInfo.output}.pdf`) : downloadInfo.output;

    imagesToPdf(pdfs[doujin.doujinId].images, outputLocation);

    // Success!
    return {
      format: PdfFormat,
      path: outputLocation
    }
  },
  onPage({ doujin }, image): void | Promise<void> {
    // Save the image into the folder
    if (/^(?:png|jpe?g)$/.test(image.extension)) {
      console.warn(`${chalk.yellowBright("WARN: ")}Unsupported file extension for page ${image.pageNumber}: "${image.extension}". Skipping...`)
      return;
    }

    const outputFile = path.join(pdfs[doujin.doujinId].path, `${image.pageNumber}.${image.extension}`);
    fs.writeFileSync(outputFile, image.data);
    pdfs[doujin.doujinId].images.push(outputFile);
  }
}

export default PdfFormat;