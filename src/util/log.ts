import chalk from "chalk";
import {argv} from "../program";

export function error(message) {
  console.error(`${chalk.redBright("ERROR: ")}${message}`);
}
export function warn(message) {
  console.error(`${chalk.yellowBright("WARN: ")}${message}`);
}
export function info(message) {
  console.log(`${chalk.blueBright("INFO: ")}${message}`);
}
export function verbose(message) {
  if (argv.v > 0)
  console.log(`${chalk.blue("VERBOSE: ")}${message}`);
}
export function debug(message) {
  if (argv.v > 1)
    console.log(`${chalk.gray("DEBUG: ")}${message}`);
}
export function trace(message) {
  if (argv.v > 2)
    console.log(`${chalk.blackBright("TRACE: ")}${message}`);
}