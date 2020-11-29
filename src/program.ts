import yargs from "yargs";
import {supportedFormats} from "./consts";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import {downloadAll} from "./downloader";
import "log-timestamp";
import die from "./util/die";
import isValidURL from "./util/isValidURL";
import readListFile from "./util/readListFile";
import {info} from "./util/log";

export const argv = yargs(process.argv.slice(2))
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
    "concurrent": {
      type: "number",
      default: 6,
      nargs: 1,
      description:
        "Sets the maximum amount of concurrent image downloads."
    },
    "clean": {
      type: "boolean",
      default: false,
      description:
        "If set to true, formatters will be asked to clean up before downloading, " +
        "which will force pages to redownload."
    },
    v: {
      type: "count",
      alias: "verbose",
      description: "The verbosity of the script."
    }
  })
  .argv;

(async () => {
  // Parse doujins to download
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
        toDownload.push(...readListFile(
          Buffer.from(fs.readFileSync(path.resolve(list))).toString("utf8").split("\n")
        ));
      }
    else {
      if (!fs.existsSync(path.resolve(argv.l)))
        die(`File does not exist: ${argv.l}`);
      toDownload.push(...readListFile(
        Buffer.from(fs.readFileSync(path.resolve(argv.l))).toString("utf8").split("\n")
      ));
    }
  }

  // Argument validation

  if (!Object.keys(supportedFormats).includes(argv.f))
    die(`Unsupported format: ${argv.f}. Available formats: ${
      Object.keys(supportedFormats).map(f => `"${f}"`).join(", ")
    }`);

  if (argv["ignore-limits"])
    console.warn(`${chalk.yellowBright("WARNING: ")}Ignoring warnings! Please don't overuse this!`)

  if (argv.concurrent) {
    if (argv.concurrent < 1)
      die("Cannot have 0 concurrent queues.");
    if (argv.concurrent > 200)
      die("Cannot have more than 200 concurrent queues.");
  }

  // Begin downloads

  const codes = [...new Set(toDownload)];

  info(`Grabbing ${codes.length} ${
    codes.length == 1 ? "doujin" : "doujins"
  }...`);

  if (codes.length === 0)
    die("Nothing to download.");

  const { totalPages, totalDoujins } = await downloadAll(codes);

  die(`Downloaded ${totalPages} ${
    totalPages === 1 ? "page" : "pages"
  } from ${totalDoujins} ${
    totalDoujins === 1 ? "doujin" : "doujins"
  }.`, 0);
})();