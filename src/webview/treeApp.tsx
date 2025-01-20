import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { commands, FileType } from "vscode";

//  import { TreeView } from "./treeComponent";

// MARK:型定義
type TreeFileNode = {
  id: string;
  dir: string;
  name: string;
  length: {
    lengthInNumber: number;
    lengthInSheet: number;
  };
  children?: TreeFileNode[];
};

interface DropResult {
  name: "before" | "inside" | "after";
  node: TreeFileNode;
}

let debugIncrement = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

let isDraggingGlobal = false;

// MARK: App
export const App: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeFileNode[]>([]);
  const [displayNumber, setDisplayNumber] = useState(false);
  const [displaySheet, setDisplaySheet] = useState(false);
  const [isOrdable, setIsOrdable] = useState(false);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [insertingNode, setInsertingNode] = useState<"file" | "folder" | null>(
    null,
  );
  const [isInserting, setIsInserting] = useState(false);
  const [draftFileType, setDraftFileType] = useState<".txt" | ".md">(".txt");

  useEffect(() => {
    vscode.postMessage({ command: "loadTreeData" });
    vscode.postMessage({ command: "loadIsOrdable" });

    // MARK: VS Code >> Tree
    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // メッセージデータを取得
      // console.log(`${debugIncrement++} ツリーに${message.command}が到着`);
      switch (message.command) {
        case "treeData":
          setTreeData(message.data); // データセット
          setDisplayNumber(message.displayNumber);
          setDisplaySheet(message.displaySheet);
          setDraftFileType(message.draftFileType);
          // vscode.postMessage({ command: "loadIsOrdable" });
          break;
        case "setHighlight":
          if (message.highlitingNode != highlightedNode) {
            setHighlightedNode(message.highlitingNode);
          }
          break;
        case "configIsOrdable":
          setIsOrdable(message.data);
          break;
        case "insertFile":
          setIsInserting(true);
          setInsertingNode(message.data);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // クリーンアップ関数でイベントリスナーを解除
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div>
      <div className="tree-wrapper">
        <DndProvider backend={HTML5Backend}>
          {treeData.length === 0 ? (
            <p>Loading...</p>
          ) : (
            treeData.map((node, index) => (
              <TreeView
                key={index}
                node={node}
                highlightedNode={highlightedNode}
                onHighlight={setHighlightedNode}
                isFirstSibling={index === 0}
                displayNumber={displayNumber}
                displaySheet={displaySheet}
                isOrdable={isOrdable}
                isInserting={isInserting}
                setIsInserting={setIsInserting}
                insertingNode={insertingNode}
                draftFileType={draftFileType}
              />
            ))
          )}
        </DndProvider>
      </div>
    </div>
  );
};

interface TreeViewProps {
  node: TreeFileNode;
  highlightedNode: string | null;
  onHighlight: (nodeDir: string) => void;
  isFirstSibling: boolean;
  displayNumber: boolean;
  displaySheet: boolean;
  isOrdable: boolean;
  insertingNode: "file" | "folder" | null;
  setIsInserting: any;
  isInserting: boolean;
  draftFileType: ".txt" | ".md";
}

// MARK: TreeView
const TreeView: React.FC<TreeViewProps> = ({
  node,
  highlightedNode,
  onHighlight,
  isFirstSibling,
  displayNumber,
  displaySheet,
  isOrdable,
  insertingNode,
  setIsInserting,
  isInserting,
  draftFileType,
}) => {
  // ツリービューの制御
  const treeNodeRef = useRef(null);
  // フォルダーが開いているかどうかを知るステータス（初期状態は開）
  const [expanded, setExpanded] = useState(true);
  // ドラッグ中かどうかを知るステータス（初期状態はfalse）
  const [isDragging, setIsDragging] = useState(false);
  // ドロップ対象かどうかを知るステータス（初期状態はfalce）
  const [isDraggedOverBefore, setIsDraggedOverBefore] = useState(false);
  const [isDraggedOverAfter, setIsDraggedOverAfter] = useState(false);
  const [isDraggedOverInside, setIsDraggedOverInside] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [isComposing, setIsComposing] = React.useState(false);
  const [insertingValue, setInsertingValue] = useState("新規ファイル");

  useEffect(() => {
    if (isInserting == true) {
      let insertingNodeName = insertingValue;
      if (isOrdable) {
        insertingNodeName =
          insertingNode == "file" ? "新規ファイル" : "新規フォルダー";
      } else {
        const match = node.name.match(/^\d+/);
        if (match != null) {
          const digit = match[0].length;
          const fileNumber = String(parseInt(match[0], 10) + 1).padStart(
            digit,
            "0",
          );

          insertingNodeName =
            insertingNode == "file"
              ? `${fileNumber}-新規ファイル${draftFileType}`
              : `${fileNumber}-新規フォルダー`;
        }
      }
      setInsertingValue(insertingNodeName);
    }
  }, [isInserting]);

  useEffect(() => {
    if (node.dir === highlightedNode && treeNodeRef.current) {
      setTimeout(() => {
        // console.log("フォーカス獲得", node.dir);
        (treeNodeRef.current as unknown as HTMLDivElement).focus();
      }, 100);
    }
  }, [highlightedNode]);

  // ドラッグ制御
  const handleDragStart = () => {
    if (!isDraggingGlobal) {
      setIsDragging(true);
      isDraggingGlobal = true;
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    isDraggingGlobal = false;
  };

  //フォルダーの開け閉め
  const toggleExpand = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  // ノードのクリック ハイライトとVS Codeに送信する部分も含む
  const handleNodeClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    if (node.dir !== highlightedNode) {
      onHighlight(node.dir);
      console.log("クリック");
      vscode.postMessage({ command: "fileSelection", node: node.dir });
      if (!node.children) {
        vscode.postMessage({
          command: "openFile",
          filePath: node.dir,
        });
      }
    } else {
      setTimeout(() => {
        (treeNodeRef.current as unknown as HTMLDivElement).focus();
      }, 100);
    }
  };

  // MARK: D&D
  // ドラッグ制御の実装

  const handleDragEnterBefore = () => {
    setIsDraggedOverBefore(true);
  };

  const handleDragLeaveBefore = () => {
    setIsDraggedOverBefore(false);
  };

  const handleDragEnterInside = () => {
    setIsDraggedOverInside(true);
  };

  const handleDragLeaveInside = () => {
    setIsDraggedOverInside(false);
  };

  const handleDragEnterAfter = () => {
    setIsDraggedOverAfter(true);
  };

  const handleDragLeaveAfter = () => {
    setIsDraggedOverAfter(false);
  };

  const [, drag] = useDrag(
    {
      type: "NODE",
      item: { id: node.id, name: node.name, dir: node.dir },
      end: (item, monitor) => {
        const dropResult: DropResult | null = monitor.getDropResult();

        // ドロップ成功時の処理
        if (dropResult && item) {
          const fileTransferData = {
            movingFileId: item.id,
            movingFileDir: item.dir,
            insertPoint: dropResult.name,
            destinationId: dropResult.node.id,
            destinationPath: dropResult.node.dir,
          };
          vscode.postMessage({
            command: "moveCommmand",
            fileTransferData: fileTransferData,
          });
          // console.log(
          //   `Move ${item.name} ${dropResult.name} to ${dropResult.node.name}`
          // );
        }
        setIsDragging(false);
        isDraggingGlobal = false;
      },
    },
    [node],
  );

  const [, dropBefore] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverBefore(false);
        return { name: "before", node: node };
      },
      collect: (monitor) => ({
        isOverBefore: monitor.isOver(),
        canDropBefore: monitor.canDrop(),
      }),
    },
    [node],
  );

  const [, dropInside] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverInside(false);
        return { name: "inside", node: node };
      },
      collect: (monitor) => ({
        isOverInside: monitor.isOver(),
        canDropInside: monitor.canDrop(),
      }),
    },
    [node],
  );

  const [, dropAfter] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverAfter(false);
        return { name: "after", node: node };
      },
      collect: (monitor) => ({
        isOverAfter: monitor.isOver(),
        canDropAfter: monitor.canDrop(),
      }),
    },
    [node],
  );

  // MARK: リネーム処理
  const handleKeyDown = (event: {
    stopPropagation: () => void;
    key: string;
  }) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      // IMEがアクティブな場合、Enterキーの動作を無視する
      if (!isComposing) {
        if (!isEditing) {
          // console.log("編集開始");
          setIsEditing(true);
        } else {
          const renamingTo = isOrdable
            ? editValue.replace(/^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/, "$1")
            : editValue;
          console.log("編集名称", editValue);
          const renameFile = {
            targetPath: node.dir,
            newName: renamingTo,
          };
          vscode.postMessage({
            command: "rename",
            renameFile: renameFile,
          });
          handleBlur();
        }
      }
    }
  };

  const handleChange = (event: {
    target: { value: React.SetStateAction<string> };
  }) => {
    // console.log("handleCnange", node.dir);
    setEditValue(event.target.value);
  };

  const handleBlur = () => {
    if (editValue === "") {
      vscode.postMessage({
        command: "alert",
        alertMessage: "名称は必ず設定してください",
      });
      setEditValue(node.name);
      setIsEditing(false);
    } else {
      setEditValue(node.name);
      setIsEditing(false);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const insertingHandleChange = (event: {
    target: { value: React.SetStateAction<string> };
  }) => {
    // console.log("挿入ファイル名", node.dir);
    setInsertingValue(event.target.value);
  };

  const insertingHandleBlur = () => {
    if (insertingValue === node.name) {
      setIsInserting(false);
    } else if (insertingValue === "") {
      vscode.postMessage({
        command: "alert",
        alertMessage: "名称は必ず設定してください",
      });
      setInsertingValue(node.name);
      setIsInserting(false);
    } else {
      setIsInserting(false);
    }
  };

  const insertingHandleKeyDown = (event: {
    stopPropagation: () => void;
    key: string;
  }) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      // IMEがアクティブな場合、Enterキーの動作を無視する
      if (!isComposing) {
        if (!isInserting) {
          setIsInserting(true);
        } else {
          const insertFile = {
            targetPath: node.dir,
            insertingNode: insertingNode,
            newName: insertingValue,
          };
          vscode.postMessage({
            command: "insert",
            renameFile: insertFile,
          });
          insertingHandleBlur();
        }
      }
    }
  };

  return (
    <div
      ref={treeNodeRef}
      tabIndex={-1} // フォーカス可能とする
      onKeyDown={handleKeyDown}
    >
      <div
        ref={
          isOrdable ? (drag as unknown as React.Ref<HTMLDivElement>) : undefined
        }
        onDragStart={isOrdable ? handleDragStart : undefined}
        onDragEnd={isOrdable ? handleDragEnd : undefined}
        className={`tree-node ${expanded ? "expanded" : ""} ${
          isDragging ? "dragged" : ""
        }`}
        onClick={handleNodeClick}
      >
        {isFirstSibling && (
          <div
            ref={dropBefore as any}
            className={`insert-bar before
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverBefore ? "dropping" : ""}`}
            onDragEnter={handleDragEnterBefore}
            onDragLeave={handleDragLeaveBefore}
          ></div>
        )}
        <div
          className={`tree-label ${!node.children ? "text" : ""} ${
            highlightedNode === node.dir && !isInserting ? "highlighted" : ""
          }`}
        >
          <span className="triangle" onClick={toggleExpand}>
            &gt;
          </span>
          {isEditing ? (
            <span className="item-name">
              {
                <input
                  type="text"
                  value={
                    isOrdable
                      ? editValue.replace(
                          /^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/,
                          "$1",
                        )
                      : editValue
                  }
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  onBlur={handleBlur}
                  autoFocus
                  className="item-name-input"
                  onClick={(event) => event.stopPropagation()}
                />
              }
            </span>
          ) : (
            <span className="item-name">
              {isOrdable
                ? node.name.replace(
                    /^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/,
                    "$1",
                  )
                : node.name}
            </span>
          )}
          <span className="chars">
            {displaySheet
              ? formatSheetsAndLines(node.length.lengthInSheet) + (
                displayNumber ?
                "(" + node.length.lengthInNumber.toLocaleString() +
                "文字)" : "")
              : displayNumber ? node.length.lengthInNumber.toLocaleString() + "文字" : ""}
          </span>
        </div>
        {node.children && (
          <div className="tree-node-children">
            {node.children.map((child, index) => (
              <TreeView
                key={child.name}
                node={child}
                highlightedNode={highlightedNode}
                onHighlight={onHighlight}
                isFirstSibling={index === 0}
                displayNumber={displayNumber}
                displaySheet={displaySheet}
                isOrdable={isOrdable}
                isInserting={isInserting}
                setIsInserting={setIsInserting}
                insertingNode={insertingNode}
                draftFileType={draftFileType}
              />
            ))}
            <div
              ref={dropInside as any}
              className={`insert-bar inside
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverInside ? "dropping" : ""}`}
              onDragEnter={handleDragEnterInside}
              onDragLeave={handleDragLeaveInside}
            ></div>
          </div>
        )}

        <div
          ref={dropAfter as any}
          className={`insert-bar after
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverAfter ? "dropping" : ""}`}
          onDragEnter={handleDragEnterAfter}
          onDragLeave={handleDragLeaveAfter}
        ></div>
      </div>
      {isInserting && highlightedNode === node.dir && (
        <div className="tree-node expanded placeholder">
          <div
            className={`tree-label highlighted ${
              insertingNode === "file" ? "text" : ""
            }`}
          >
            <span className="item-name">
              {
                <input
                  type="text"
                  value={insertingValue}
                  onChange={insertingHandleChange}
                  onKeyDown={insertingHandleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  onBlur={insertingHandleBlur}
                  autoFocus
                  className="item-name-input"
                  onClick={(event) => event.stopPropagation()}
                />
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// MARK: ユーティリティ関数
// charactorcount.ts からコピー
function formatSheetsAndLines(sheetFloat: number): string {
  if (sheetFloat == 0) {
    return "0枚0行";
  }
  const sheetInt = Math.floor(sheetFloat);
  const modLines = (sheetFloat - sheetInt) * 20;

  // 行が0でない時だけsheetIntを増やす
  const sheetsStr = `${Intl.NumberFormat().format(sheetInt + (modLines > 0 ? 1 : 0))}枚`;

  // 行の出力は20行から0行に変更
  const linesStr =
    modLines > 0 ? `${Intl.NumberFormat().format(modLines)}行` : "20行";

  return `${sheetsStr}${linesStr ? `${linesStr}` : ""}`;
}

// root.render を呼び出す
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
