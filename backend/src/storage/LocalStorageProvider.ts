import fs from "fs";
import path from "path";
import type { Readable } from "stream";
import type { StorageProvider } from "./StorageProvider";

export class LocalStorageProvider implements StorageProvider {
  private root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  // Resolves a key to a path and refuses anything that escapes the storage root
  private resolveKey(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async save(sourcePath: string, key: string): Promise<void> {
    const dest = this.resolveKey(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    // COPYFILE_EXCL: never overwrite an existing stored file
    await fs.promises.copyFile(sourcePath, dest, fs.constants.COPYFILE_EXCL);
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.resolveKey(key);
    await fs.promises.access(full);
    return fs.createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    await fs.promises.rm(this.resolveKey(key), { force: true });
  }
}