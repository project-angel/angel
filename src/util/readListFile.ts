import chalk from "chalk";
import isValidURL from "./isValidURL";

export default function(items : string[]) : number[] {
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