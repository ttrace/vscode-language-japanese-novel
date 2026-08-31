export type SequentialRename = {
  oldName: string;
  newName: string;
};

export type SequentialRenamePlan = {
  movingFileName: string;
  renames: SequentialRename[];
};

/**
 * 連番後に名前が変わる項目だけを返す。
 * 同一フォルダー内の並べ替えで無関係な前後のファイルまで書き換えないため、
 * oldName と newName が同じ項目は計画に含めない。
 */
export function createSequentialRenamePlan(
  fileNames: readonly string[],
  destinationIndex: number,
  insertPoint: "before" | "inside" | "after",
): SequentialRenamePlan {
  const renames: SequentialRename[] = [];
  const skipIndex = insertPoint === "before" ? 0 : destinationIndex + 1;
  const postNumbering = destinationIndex === -1;
  const digits = fileNames.length.toString().length;
  let fileIndex = 1;
  let movingFileName = "";

  for (let index = 0; index < fileNames.length; index++) {
    const oldName = fileNames[index];
    if (oldName.startsWith("moving-")) {
      movingFileName = oldName;
      continue;
    }

    if (index === skipIndex && !postNumbering) {
      fileIndex++;
    }

    const baseName = oldName.replace(/^\d+[-_\s]*/, "");
    const newName = `${String(fileIndex).padStart(digits, "0")}-${baseName}`;
    fileIndex++;

    if (oldName !== newName) {
      renames.push({ oldName, newName });
    }
  }

  return { movingFileName, renames };
}
