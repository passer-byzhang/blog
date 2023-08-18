import { join } from "path";

export default function relativePath(path: string) {
  console.log("cwd: " + process.cwd());
  return join(process.cwd(), path);
}
