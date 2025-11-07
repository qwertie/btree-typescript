export function check(fact: boolean, ...args: any[]) {
  if (!fact) {
    args.unshift('B+ tree');
    throw new Error(args.join(' '));
  }
}
