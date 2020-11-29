import {Doujin, Image} from "nhentai";
import {DownloadedImage, DownloadInfo, Format} from "./typedefs";
import chalk from "chalk";
import {FetchError} from "node-fetch";
import { argv } from "./program";
import sleep from "./util/sleep";
import {supportedFormats} from "./consts";
import path from "path";
import nhentai from "nhentai";
import pathEscape from "./util/pathEscape";
import getIdentifier from "./util/getIdentifier";

async function getImage(doujin : Doujin, page : "cover" | "thumbnail" | number) : Promise<DownloadedImage | null> {
  let pageTries = 0, image : Image, data : Buffer;
  while (pageTries++ != 10) {
    if (pageTries >= 10) {
      console.error(`${chalk.redBright("ERROR: ")}Too many attempts failed. Skipping this doujin...`);
      return;
    }
    try {
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

      if (argv.v > 2)
        console.log(`${chalk.blackBright("TRACE: ")}GET ${image.url}`);
      data = await image.fetchBuffer();
      break;
    } catch (e) {
      if (e instanceof FetchError) {
        console.error(`${chalk.redBright("ERROR: ")}Error getting page "${page}": ${e.message}`);
        if (argv.v > 0)
          console.error(e);

        await sleep(2000);
      } else {
        console.error(`${chalk.redBright("ERROR: ")}${e.message}. Skipping this doujin...`);
        if (argv.v > 0)
          console.error(e);
        return;
      }
    }
  }

  const downloadedImage : DownloadedImage = {
    ...image,
    fetchBuffer: image.fetchBuffer,
    download: image.download,
    data: data,
    pageNumber: typeof page === "number" ? page + 1 : undefined
  };
  if (argv.v > 2)
    console.dir(downloadedImage);
  return downloadedImage;
}

const api = new nhentai.API();
export async function downloadAll(codes : number[]) : Promise<{ totalPages: number, totalDoujins: number }> {
  const multipleTargets = codes.length > 1;

  let totalPages = 0, totalDoujins = 0;

  async function download(item : number) {
    let tries = 0, doujin : Doujin;
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
          if (argv.v > 0)
            console.error(e);

          await sleep(2000);
        } else {
          console.error(`${chalk.redBright("ERROR: ")}${e.message}. Skipping this doujin...`);
          if (argv.v > 0)
            console.error(e);
          return;
        }
      }
    }

    console.log(`${chalk.blueBright("INFO: ")} Downloading: "${
      doujin.titles.english ?? doujin.titles.japanese ?? doujin.doujinId
    }".`);

    const format : Format = supportedFormats[argv.f];
    const downloadInfo : DownloadInfo = {
      format: format,
      correctExtension: multipleTargets ? !argv["no-output-correction"] : true,
      output: multipleTargets ?
        path.join(argv.o ?? ".", pathEscape(getIdentifier(argv["target-identifier"], doujin)))
        : argv.o ?? pathEscape(doujin.titles.english ?? doujin.titles.japanese ?? `${doujin.doujinId}`)
    };

    const details = { downloadInfo: downloadInfo, doujin: doujin, logLevel: argv.v };
    if (format.preDownload)
      await format.preDownload(details);

    if (format.onCover) {
      if (argv.v > 1)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloading cover of ${item}...`);

      const image = await getImage(doujin, "cover");
      await format.onCover(details, image);

      if (argv.v > 2)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloaded cover of ${item}...`);

      if (!argv["ignore-limits"]) await sleep(500);
    }

    if (format.onThumbnail) {
      if (argv.v > 1)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloading thumbnail of ${item}...`);

      const image = await getImage(doujin, "thumbnail");
      await format.onThumbnail(details, image);

      if (argv.v > 2)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloaded thumbnail of ${item}...`);

      if (!argv["ignore-limits"]) await sleep(500);
    }

    for (const pageNumber in doujin.pages) {
      const page = doujin.pages[pageNumber];
      if (format.skipPage && await format.skipPage(details, {
        ...page,
        fetchBuffer: page.fetchBuffer,
        download: page.download,
        pageNumber: +(pageNumber) + 1
      })) {
        if (argv.v > 1)
          console.log(`${chalk.blueBright("VERBOSE: ")}Skipping page ${+(pageNumber) + 1}/${
            doujin.pages.length
          } of ${item} [skipPage = true]`);
        continue;
      }

      if (argv.v > 1)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloading page ${+(pageNumber) + 1}/${
          doujin.pages.length
        } of ${item}...`);

      // 325667
      const image = await getImage(doujin, +(pageNumber));
      await format.onPage(details, image);

      if (argv.v > 2)
        console.log(`${chalk.blueBright("VERBOSE: ")}Downloaded page ${+(pageNumber) + 1}/${
          doujin.pages.length
        } of ${item}...`);

      if (!argv["ignore-limits"]) await sleep(500);
    }

    const outputs = await format.postDownload(details);
    if (outputs["children"] != null) {
      console.log(`${chalk.blueBright("INFO: ")} File(s) saved to "${outputs.path}".`);
      if (argv.v > 3) {

        console.log(
          outputs["children"].map(f => `\t${chalk.blue(f)}`).join("\n")
        );
      }
    } else {
      console.log(`${chalk.blueBright("INFO: ")} File saved to "${outputs.path}".`);
    }

    totalPages += doujin.pages.length;
    totalDoujins++;
  }

  for (const item of codes) {
    if (argv.v > 0)
      console.log(`${chalk.blueBright("INFO: ")}Attempting to get doujin with ID: ${item}...`);

    await download(item);
  }

  return { totalPages: totalPages, totalDoujins: totalDoujins };
}