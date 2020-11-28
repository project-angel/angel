import {Details, OutputFile, SingleFormat} from "../typedefs";
import JSZip from "jszip";
import generateInfo from "../util/generateInfo";
import * as fs from "fs";

const zips : { [key : string]: JSZip } = {};

/**
 * Exports the doujin in a ZIP format
 *
 * @author ProjectAngelAuthor
 */
const ZipFormat : SingleFormat = {
  single: true,
  preDownload({ doujin }): void | Promise<void> {
    // Create the zip file
    const zip = zips[doujin.doujinId] = new JSZip();

    // Add the doujin information into the zip file
    zip.file("info.json", generateInfo(doujin));
  },
  async postDownload({ downloadInfo, doujin }: Details): Promise<OutputFile> {
    const zip = zips[doujin.doujinId];

    // Determine the proper output location
    let outputLocation = downloadInfo.correctExtension ?
      (downloadInfo.output.endsWith(".zip") ?
        downloadInfo.output : `${downloadInfo.output}.zip`) : downloadInfo.output;

    // Generate the zip
    const data = await zip.generateAsync({ type: "nodebuffer" });
    // Write the zip onto the file
    const outputFile = fs.createWriteStream(outputLocation, {flags : "w"});
    await new Promise(res => {
      outputFile.write(data, res);
    });
    outputFile.end();

    // Success!
    return {
      format: ZipFormat,
      path: outputLocation
    }
  },
  onPage({ doujin }, image): void | Promise<void> {
    // Save the file into the zip
    zips[doujin.doujinId]
      .file(`${image.pageNumber}.${image.extension}`, image.data, { binary: true });
  }
}

export default ZipFormat;