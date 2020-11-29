import {Doujin, Image} from "nhentai";

export interface DownloadInfo {
  output: string;
  format: Format;
  correctExtension: boolean;
}

export interface OutputFile {
  format: Format;
  /** Absolute path. */
  path: string;
}

export interface OutputPath extends OutputFile {
  /** Relative to `path`. */
  children: string[];
}

export type Format = SingleFormat | MultipleFormat;

export interface Details {
  /** The download information. */
  downloadInfo: DownloadInfo;
  /** The doujin information. */
  doujin: Doujin;
  /** The log level (from 0 to 3) */
  logLevel: number;
}

type PromiseOrNot<T> = T | Promise<T>;
export type DownloadedImage = Image & { data : Buffer, pageNumber? : number };

interface BaseFormat {
  /**
   * Called prior to downloading the cover, thumbnail, or pages. Use this
   * to setup your file format or to store information beforehand.
   * @param details The download details.
   */
  preDownload?: (details: Details) => PromiseOrNot<void>;
  /**
   * Called when the cover of the doujin has been downloaded. If not supplied,
   * the cover will not be downloaded at all.
   * @param details The download details.
   * @param image The cover, along with the image data as a `Buffer`.
   */
  onCover?: (details: Details, image : DownloadedImage) => PromiseOrNot<void>;
  /**
   * Called when the thumbnail of the doujin has been downloaded. If not supplied,
   * the thumbnail will not be downloaded at all.
   * @param details The download details.
   * @param image The thumbnail, along with the image data as a `Buffer`.
   */
  onThumbnail?: (details: Details, image : DownloadedImage) => PromiseOrNot<void>;
  /**
   * Called when a page of the doujin has been downloaded.
   *
   * Since pages are not downloaded in order, you need to utilize the page number
   * to ensure the correct order of images.
   * @param details The download details.
   * @param image The image, along with the image data as a `Buffer` and the page number.
   */
  onPage: (details: Details, image : DownloadedImage) => PromiseOrNot<void>;
  /**
   * Check if a page should be skipped. This function is called if the user has an
   * intent to continue the download (such as if a download cut midway).
   * @param details The download details.
   * @param image The image, along with the image data as a `Buffer` and the page number.
   */
  skipPage?: (details: Details, image : Omit<DownloadedImage, "data">) => PromiseOrNot<boolean>;
}

export interface SingleFormat extends BaseFormat {
  /** Whether or not this format outputs a singular file */
  single: true;
  /**
   * Called when all pages are done downloading. Use this to save your file.
   * @param details The download details.
   * @returns The output file.
   */
  postDownload: (details: Details) => PromiseOrNot<OutputFile>;
}

export interface MultipleFormat extends BaseFormat {
  /** Whether or not this format outputs a singular file */
  single: false;
  /**
   * Called when all pages are done downloading. Use this to save your file.
   * @param details The download details.
   * @returns The output path details, and a list of files output by the format.
   */
  postDownload: (details: Details) => PromiseOrNot<OutputPath>;
}