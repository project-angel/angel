import yargs from "yargs";
import {supportedFormats} from "./consts";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import {DownloadedImage, DownloadInfo, Format} from "./typedefs";
import * as nhentai from "nhentai";
import { FetchError } from "node-fetch";
import {Doujin, Image} from "nhentai";

import "log-timestamp";

const argv = yargs(process.argv.slice(2))
  .usage("Usage: $0 <-f format> <-c|-l|-u> <target> [options]")
  .help("h")
  .alias("h", "help")
  .options({
    f: {
      choices: Object.keys(supportedFormats),
      alias: "format",
      nargs: 1,
      demandOption: true,
      description:
        "The format to output as."
    },
    o: {
      type: "string",
      alias: "output",
      nargs: 1,
      description:
        "The output folder or file. If only one target is supplied, and the format " +
        "only outputs one file, this will be the name of that file. If only one target " +
        "is supplied but the format outputs multiple files, this will be the name of the " +
        "folder containing the pages. If there are multiple targets supplied, this will be " +
        "the folder containing each target, with the name to use defined by --target-identifier"
    },
    "target-identifier": {
      choices: ["id", "name-en", "name-jp"],
      default: "name-en",
      nargs: 1,
      description: "What to identify targets with if multiple targets were provided."
    },
    "no-output-correction": {
      type: "boolean",
      default: false,
      nargs: 1,
      description:
        "Prevents automatically adding the proper extension if the file format  " +
        "requested only outputs one file. If multiple targets are provided, this is " +
        "disabled no matter what."
    },
    u: {
      type: "string",
      alias: "url",
      description: "The URL to download from.",
      array: true
    },
    c: {
      type: "number",
      alias: "code",
      description: "The code of the file to download.",
      array: true
    },
    l: {
      type: "string",
      alias: "list",
      description: "A file with URLs or codes to download for each line.",
      array: true
    },
    "ignore-limits": {
      type: "boolean",
      default: false,
      nargs: 1,
      description:
        "Whether or not to ignore rate limits (which are set to prevent load " +
        "on the website's servers.)"
    },
    v: {
      type: "count",
      alias: "verbose",
      description: "The verbosity of the script."
    }
  })
  .argv;

(async () => {
  function die(message : string, code = 1) {
    console.error((code === 0 ? chalk.greenBright("DONE: ") : chalk.redBright("ABORTED: ")) + message);
    process.exit(code);
  }

  function isValidURL(urlString : string) : boolean {
    try {
      const url = new URL(urlString);
      return /(\.|^)nhentai\.net$/i.test(url.hostname) && /^\/g\/\d+\/?$/i.test(url.pathname);
    } catch (e) {
      return false;
    }
  }

  function readList(items : string[]) : number[] {
    const codes = [];
    for (const item of items) {
      const trimmed = item.trim();
      if (!isNaN(+(trimmed)))
        codes.push(trimmed);
      else if (isValidURL(trimmed))
        codes.push(/\/g\/(\d+)/g.exec(trimmed)[1]);
      else {
        console.error(`${chalk.yellowBright("WARNING: ")}Skipping invalid URL/code from list: ${trimmed}`);
      }
    }
    return codes;
  }

  async function sleep(timeout : number) : Promise<void> {
    return new Promise((res) => { setTimeout(() => {res()}, timeout) });
  }

  function pathEscape(path : string) : string {
    return path.replace(/[/\\?%*:|"<>]/g, "_");
  }

  function getIdentifier(identifierType : string, doujin : Doujin) {
    switch (identifierType) {
      case "id":
        return `${doujin.doujinId}`;
      case "name-jp":
        return doujin.titles.japanese ?? doujin.titles.english ?? `${doujin.doujinId}`;
      default:
        return doujin.titles.english ?? `${doujin.doujinId}`;
    }
  }

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

  const toDownload : number[] = [];

  if (!argv.u && argv.c == null && !argv.l) {
    die("Neither a URL, a code, nor a list was provided.");
  }

  if (argv.u) {
    if (Array.isArray(argv.u)) {
      for (const url of argv.u) {
        if (!isValidURL(url)) die(`Invalid URL provided: ${url}`);
        toDownload.push(+(/\/g\/(\d+)/g.exec(url)[1]));
      }
    } else {
      if (!isValidURL(argv.u)) die(`Invalid URL provided: ${argv.u}`);
      toDownload.push(+(/\/g\/(\d+)/g.exec(argv.u)[1]));
    }
  }

  if (argv.c) {
    if (Array.isArray(argv.c))
      for (const code of argv.c)
        toDownload.push(code);
    else toDownload.push(argv.c);
  }

  if (argv.l) {
    if (Array.isArray(argv.l))
      for (const list of argv.l) {
        if (!fs.existsSync(path.resolve(list)))
          die(`File does not exist: ${list}`);
        toDownload.push(...readList(
          Buffer.from(fs.readFileSync(path.resolve(list))).toString("utf8").split("\n")
        ));
      }
    else {
      if (!fs.existsSync(path.resolve(argv.l)))
        die(`File does not exist: ${argv.l}`);
      toDownload.push(...readList(
        Buffer.from(fs.readFileSync(path.resolve(argv.l))).toString("utf8").split("\n")
      ));
    }
  }

  if (!Object.keys(supportedFormats).includes(argv.f))
    die(`Unsupported format: ${argv.f}. Available formats: ${
      Object.keys(supportedFormats).map(f => `"${f}"`).join(", ")
    }`);

  if (argv["ignore-limits"])
    console.warn(`${chalk.yellowBright("WARNING: ")}Ignoring warnings! Please don't overuse this!`)

  const codes = [...new Set(toDownload)];
  const multipleTargets = codes.length > 1;

  console.log(`${chalk.blueBright("INFO: ")}Grabbing ${codes.length} ${
    codes.length == 1 ? "doujin" : "doujins"
  }...`);

  const api = new nhentai.API();

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

      // 325667
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

  if (codes.length === 0)
    die("Nothing to download.");

  for (const item of codes) {
    if (argv.v > 0)
      console.log(`${chalk.blueBright("INFO: ")}Attempting to get doujin with ID: ${item}...`);

    await download(item);
  }

  die(`Downloaded ${totalPages} ${
    totalPages === 1 ? "page" : "pages"
  } from ${totalDoujins} ${
    totalDoujins === 1 ? "doujin" : "doujins"
  }.`, 0);
})();