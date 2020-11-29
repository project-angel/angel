import * as nhentai from "nhentai";
import {Doujin, Image} from "nhentai";
import {DownloadedImage, DownloadInfo, Format} from "./typedefs";
import chalk from "chalk";
import {FetchError} from "node-fetch";
import {argv} from "./program";
import sleep from "./util/sleep";
import {supportedFormats} from "./consts";
import path from "path";
import pathEscape from "./util/pathEscape";
import getIdentifier from "./util/getIdentifier";
import {debug, info, trace, verbose} from "./util/log";

interface ImageDownloadQueue {
  id: number;
  aborted: boolean;
  promise?: Promise<void>,
  jobs: ImageDownloadQueueJob[];
}

interface ImageDownloadQueueJob {
  image: Image;
  promise: Promise<Buffer>;
  resolver: (data: Buffer) => void;
  rejector: (error: Error) => void;
}

class ImageDownloadQueueHandler {
  queues: ImageDownloadQueue[] = [];

  static async handleStream(queue : ImageDownloadQueue) {
    debug(`Queue started: ${queue.id}`);

    while (!queue.aborted) {
      await sleep(50);

      if (queue.jobs.length == 0) continue;

      const {image, resolver, rejector} = queue.jobs.shift();

      trace(`GET ${image.url}`);
      try {
        const start = Date.now();
        const data = await image.fetchBuffer();
        trace(`Done getting ${image.url} after ${((Date.now() - start) / 1000).toFixed(2)}s`);
        resolver(data);
      } catch (e) {
        rejector(e);
      }

      if (!argv["ignore-limits"])
        await sleep(500);
    }

    debug(`Queue aborted: ${queue.id}`);
  }

  constructor() {
    for (let streamId = 0; streamId < argv.concurrent; streamId++) {
      const stream : ImageDownloadQueue = this.queues[streamId] = {
        id: streamId,
        aborted: false,
        jobs: []
      };

      stream.promise = new Promise((res) => {
        ImageDownloadQueueHandler.handleStream(stream).then(res);
      });
    }
  }

  abortAll() {
    for (const queue of this.queues) queue.aborted = true;
  }

  findAvailableQueue() {
    let lowest: ImageDownloadQueue = null;
    for (const queue of this.queues)
      if (lowest == null) lowest = queue;
      else if (queue.jobs.length < lowest.jobs.length) lowest = queue;
    return lowest;
  }

  async queue(image : Image) : Promise<ImageDownloadQueueJob> {
    let res = null, rej = null;
    const promise = new Promise<Buffer>((resolve, reject) => {
      res = resolve;
      rej = reject;
    });

    const queue = this.findAvailableQueue();
    debug(`Queued ${image.url} into queue #${queue.id}.`);

    // noinspection JSUnusedAssignment
    const job = {
      image: image,
      promise: promise,
      resolver: res,
      rejector: rej
    };
    queue.jobs.push(job);

    return job;
  }
}

async function getImage(
  queueHandler: ImageDownloadQueueHandler,
  doujin : Doujin,
  page : "cover" | "thumbnail" | number
) : Promise<DownloadedImage | null> {
  let pageTries = 0, image : Image, data : Buffer;
  image = (() => {
    switch (page) {
      case "cover":
        return doujin.cover;
      case "thumbnail":
        return doujin.thumbnail;
      default:
        return doujin.pages[page];
    }
  })();

  while (pageTries++ != 10) {
    if (pageTries >= 10) {
      console.error(`${chalk.redBright("ERROR: ")}Too many attempts failed. Skipping this doujin...`);
      return;
    }
    try {
      const job = await queueHandler.queue(image);
      data = await job.promise;
      break;
    } catch (e) {
      if (e instanceof FetchError) {
        console.error(`${chalk.redBright("ERROR: ")}Error getting page "${page}": ${e.message}`);
        console.error(e);

        await sleep(2000);
      } else {
        console.error(`${chalk.redBright("ERROR: ")}${e.message}. Skipping this doujin...`);
        console.error(e);
        return;
      }
    }
  }

  return {
    ...image,
    fetchBuffer: image.fetchBuffer,
    download: image.download,
    data: data,
    pageNumber: typeof page === "number" ? page + 1 : undefined
  };
}

const api = new nhentai.API();
export async function downloadAll(codes : number[]) : Promise<{ totalPages: number, totalDoujins: number }> {
  const queueHandler = new ImageDownloadQueueHandler();
  const multipleTargets = codes.length > 1;

  let totalPages = 0, totalDoujins = 0;

  async function download(item : number) {
    let tries = 0, doujin : Doujin;

    verbose(`Getting doujin information for ${item}...`);
    while (tries++ < 10) {
      if (tries >= 10) {
        console.error(`${chalk.redBright("ERROR: ")}Too many attempts failed. Skipping...`);
        return;
      }
      try {
        doujin = await api.fetchDoujin(item);
        break;
      } catch (e) {
        if (e instanceof FetchError) {
          console.error(`${chalk.redBright("ERROR: ")}Error getting doujin information: ${e.message}`);
          console.error(e);

          await sleep(2000);
        } else {
          console.error(`${chalk.redBright("ERROR: ")}${e.message}. Skipping this doujin...`);
          console.error(e);
          return;
        }
      }
    }

    const format : Format = supportedFormats[argv.f];
    const downloadInfo : DownloadInfo = {
      format: format,
      correctExtension: multipleTargets ? !argv["no-output-correction"] : true,
      output: multipleTargets ?
        path.join(argv.o ?? ".", pathEscape(getIdentifier(argv["target-identifier"], doujin)))
        : argv.o ?? pathEscape(doujin.titles.english ?? doujin.titles.japanese ?? `${doujin.doujinId}`)
    };

    const details = { downloadInfo: downloadInfo, doujin: doujin, logLevel: argv.v };

    if (argv.clean && format.cleanup) {
      debug("Cleaning up before download...");
      await format.cleanup(details);
    }

    info(`Downloading: "${
      doujin.titles.english ?? doujin.titles.japanese ?? doujin.doujinId
    }".`);

    if (format.preDownload)
      await format.preDownload(details);

    const pagePromises : Promise<void>[] = [];

    if (format.onCover) {
      trace("onCover set, queuing cover for download.");
      pagePromises.push(new Promise(async (res) => {
        verbose(`Downloading cover of ${item}...`);

        const image = await getImage(queueHandler, doujin, "cover");
        await format.onCover(details, image);

        verbose(`Downloaded cover of ${item}...`);
        res();
      }));
    }

    if (format.onThumbnail) {
      trace("onThumbnail set, queuing thumbnail for download.");
      pagePromises.push(new Promise(async (res) => {
        verbose(`Downloading thumbnail of ${item}...`);

        const image = await getImage(queueHandler, doujin, "thumbnail");
        await format.onThumbnail(details, image);

        verbose(`Downloaded thumbnail of ${item}...`);
        res();
      }));
    }

    let downloadedPages = 0;
    for (const pageNumber in doujin.pages) {
      pagePromises.push(new Promise(async (res) => {
        const page = doujin.pages[pageNumber];
        if (format.skipPage && await format.skipPage(details, {
          ...page,
          fetchBuffer: page.fetchBuffer,
          download: page.download,
          pageNumber: +(pageNumber) + 1
        })) {
          verbose(`Skipping page ${+(pageNumber) + 1}/${
            doujin.pages.length
          } of ${item} [skipPage = true]`);
          res(); return;
        }

        verbose(`Downloading page ${+(pageNumber) + 1}/${
          doujin.pages.length
        } of ${item}...`);

        const image = await getImage(queueHandler, doujin, +(pageNumber));
        await format.onPage(details, image);

        verbose(`Downloaded page ${+(pageNumber) + 1} (${
          ++downloadedPages
        }/${doujin.pages.length}) of ${item}...`);

        res();
      }));
    }

    await Promise.all(pagePromises);
    info(`Download of "${doujin.titles.english ?? doujin.titles.japanese ?? doujin.doujinId}" finished.`);

    const outputs = await format.postDownload(details);
    if (outputs["children"] != null) {
      info(`File(s) saved to "${outputs.path}".`);
      trace(path.resolve(outputs.path));
      console.log(
        outputs["children"].map(f => `\t${chalk.blue(f)}`).join("\n")
      );
    } else {
      info(`File saved to "${outputs.path}".`);
      trace(path.resolve(outputs.path));
    }

    totalPages += doujin.pages.length;
    totalDoujins++;
  }

  for (const item of codes) {
    info(`Attempting to get doujin with ID: ${item}...`);

    await download(item);
  }

  queueHandler.abortAll();

  return { totalPages: totalPages, totalDoujins: totalDoujins };
}