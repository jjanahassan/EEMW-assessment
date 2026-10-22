import type { Readable } from "stream";

export interface StorageProvider {
  /** Copy a file from a local path into storage under `key`. */
  save(sourcePath: string, key: string): Promise<void>;
  /** Open a stream to read a stored file. */
  getStream(key: string): Promise<Readable>;
  /** Remove a stored file. Must not fail if it doesn't exist. */
  delete(key: string): Promise<void>;
}