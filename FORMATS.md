# Formats
A list of compatible exportable formats, their authors, and their dependencies.

## `img`
A folder containing all pages as images. This is the safest format to export as, and is bound to work almost all the time.
* **Author**: ProjectAngelAuthor <projectangelauthor@gmail.com>
* **Since**: 1.0.0
* **Exports**: Doujin information (as `info.json`), cover, thumbnail, and pages
* **Creates**: A normal folder (by the doujin's English name by default) containing all downloaded files.

## `pdf`
A PDF (Portable Document Format) file. This file can be opened by many PDF readers which are available on almost all platforms.

Due to limitations of the PDF format, only PNG and JPG files are accepted, and the formatter will skip all other file types.
* **Author**: ProjectAngelAuthor <projectangelauthor@gmail.com>
* **Since**: 1.0.0
* **Dependencies**: [`jszip`](https://npmjs.com/package/jszip)
* **Exports**: Doujin pages
* **Creates**: A single PDF file containing all downloaded and compatible pages.

## `zip`
A compressed ZIP file. This file downloads all data and saves it inside of the ZIP file.
* **Author**: ProjectAngelAuthor <projectangelauthor@gmail.com>
* **Since**: 1.0.0
* **Dependencies**: [`jszip`](https://npmjs.com/package/jszip)  
* **Exports**: Doujin information (as `info.json`), cover, thumbnail, and pages
* **Creates**: A single ZIP file containing all downloaded files.

# Writing Formats
You're allowed to add more dependencies, however, as much as possible keep it to a minimum and reuse whatever libraries are already available, or use standard Node.js functions.

Formats should be a `Format`, as defined by `typedefs.js`. Required functions are defined in that same file. As usual, you can use existing formats as a basis for your format.

Images are downloaded asynchronously from each other, so you'll need to rely on `pageNumber` from the provided `DownloadedImage` in case you want to keep some sort of order with your pages.

When you're done writing your format, feel free to make a pull request for it, and be sure to document your format in this file.