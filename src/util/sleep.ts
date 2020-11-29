export default async function(timeout : number) : Promise<void> {
  return new Promise((res) => { setTimeout(() => {res()}, timeout) });
}