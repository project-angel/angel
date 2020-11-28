import {Doujin} from "nhentai";

export default function(doujin : Doujin) {
    return JSON.stringify({ ...doujin, saved_at: new Date() }, null, 4);
}