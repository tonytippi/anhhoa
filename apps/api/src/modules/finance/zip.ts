import { crc32 } from "node:zlib";

// A minimal ZIP writer for the run's payment images. PNGs are already compressed, so entries are stored as-is.
// File names are UTF-8 (general purpose flag bit 11) so Vietnamese names open correctly on Windows and macOS.
export function zipStore(files: Array<{ name: string; data: Buffer }>, modifiedAt = new Date()): Buffer {
  const time = ((modifiedAt.getHours() << 11) | (modifiedAt.getMinutes() << 5) | Math.floor(modifiedAt.getSeconds() / 2)) & 0xffff;
  const date = (((modifiedAt.getFullYear() - 1980) << 9) | ((modifiedAt.getMonth() + 1) << 5) | modifiedAt.getDate()) & 0xffff;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, file.data);
    centrals.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// "<Lớp>_<Tên học sinh>_<Tên đợt thu>.png", with characters Windows forbids in file names replaced by "-".
export function paymentImageFileName(parts: string[], extension = "png") {
  return `${parts.map((part) => part.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim()).join("_")}.${extension}`;
}
