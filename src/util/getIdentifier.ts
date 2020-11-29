import {Doujin} from "nhentai";

export default function(identifierType : string, doujin : Doujin) {
  switch (identifierType) {
    case "id":
      return `${doujin.doujinId}`;
    case "name-jp":
      return doujin.titles.japanese ?? doujin.titles.english ?? `${doujin.doujinId}`;
    default:
      return doujin.titles.english ?? `${doujin.doujinId}`;
  }
}