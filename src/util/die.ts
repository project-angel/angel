import chalk from "chalk";

export default function(message : string, code = 1) {
  console.error((code === 0 ? chalk.greenBright("DONE: ") : chalk.redBright("ABORTED: ")) + message);
  process.exit(code);
}