import {Details, MultipleFormat, OutputPath} from "../typedefs";
import generateInfo from "../util/generateInfo";
import * as fs from "fs";
import * as path from "path";

const downloaded : { [key : string] : string[] } = {};

/**
 * Exports the doujin as images in a folder. This saves the images
 * regardless of extension.
 *
 * @author ProjectAngelAuthor
 */
const ImgFormat : MultipleFormat = {
  single: false,
  cleanup({downloadInfo}): void {
    if (fs.existsSync(downloadInfo.output))
      fs.rmdirSync(downloadInfo.output, { recursive: true });
  },
  preDownload({ downloadInfo, doujin }): void | Promise<void> {
    if (!fs.existsSync(downloadInfo.output))
      fs.mkdirSync(downloadInfo.output, { recursive: true });
    downloaded[doujin.doujinId] = [];

    // Add the doujin information into the folder
    fs.writeFileSync(path.join(downloadInfo.output, "info.json"), generateInfo(doujin));
  },
  postDownload({ downloadInfo, doujin }: Details): OutputPath {
    // Success!
    return {
      format: ImgFormat,
      path: downloadInfo.output,
      children: downloaded[doujin.doujinId]
    };
  },
  onCover({ downloadInfo, doujin }, image): void | Promise<void> {
    // Save the image into the folder
    fs.writeFileSync(path.join(downloadInfo.output, `cover.${image.extension}`), image.data);
  },
  onThumbnail({ downloadInfo, doujin }, image): void | Promise<void> {
    // Save the image into the folder
    fs.writeFileSync(path.join(downloadInfo.output, `thumbnail.${image.extension}`), image.data);
  },
  onPage({ downloadInfo, doujin }, image): void | Promise<void> {
    // Save the image into the folder
    fs.writeFileSync(path.join(downloadInfo.output, `${image.pageNumber}.${image.extension}`), image.data);
  },
  skipPage({ downloadInfo, doujin }, image): boolean {
    return fs.existsSync(path.join(downloadInfo.output, `${image.pageNumber}.${image.extension}`));
  }
}

export default ImgFormat;