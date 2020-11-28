# Project Angel
Project Angel started as a small 5-hour joke that eventually became a whole project. This is the effects of boredom during the COVID-19 quarantines.

Made during the 28th day of No Nut November 2020.

Project Angel　（プロジェクトエンゼル）　は真面目なプロジェクトになった五時間な少冗談でした. これはCOVID-19検疫で退屈の影響。

ノナット11月（笑）28日2020年に作りました。

# Usage
```bash
project-angel <-c|-u|-l> <target> 
```
You need to define at least one source with `-c <code>`, `-u <url>`, or `-l <path to file list>`. You also need to provide a format with `-f` or `--format`. A list of available formats is in the program's help page, which you can open by passing the `-h` argument.

# Development
It's definitely open to changes, especially more formats to convert into. Make a pull request and I'll check it out.

## Building
To compile TypeScript only:
```bash
npm run compile
```
To build the binaries as well:
```bash
npm run build
```

# Why a scraper?
Why not just use the torrents? Because I'm lazy, and there was already an API for the website on npm.

# License
MIT.