import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { commands } from "vscode";

//  import { TreeView } from "./treeComponent";

// MARK:型定義
type TreeFileNode = {
  id: string;
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
};

interface DropResult {
  name: "before" | "inside" | "after";
  node: TreeFileNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

let isDraggingGlobal = false;


// MARK: App
export const App: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeFileNode[]>([]);
  const [isOrdable, setIsOrdable] = useState(false);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  useEffect(() => {
    vscode.postMessage({ command: "loadTreeData" });
    vscode.postMessage({ command: "loadIsOrdable" });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // メッセージデータを取得
      switch (message.command) {
        case "treeData":
          setTreeData(message.data); // データセット
          vscode.postMessage({ command: "loadIsOrdable" });
          break;
        case "clearHighlight":
          setHighlightedNode(null);
          vscode.postMessage({command:"fileSelection",node:null});
          break;
        case "configIsOrdable":
          setIsOrdable(message.data);
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
                isOrdable={isOrdable}
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
  isOrdable: boolean;
}

// MARK: TreeView
const TreeView: React.FC<TreeViewProps> = ({
  node,
  highlightedNode,
  onHighlight,
  isFirstSibling,
  isOrdable
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
    if (!node.children) {
      vscode.postMessage({
        command: "openFile",
        filePath: node.dir,
      });
    }
    // ハイライトを少し遅らせて設定
    setTimeout(() => {
      onHighlight(node.dir);
      vscode.postMessage({command:"fileSelection",node:node.dir});
      if (treeNodeRef.current) {
        (treeNodeRef.current as HTMLDivElement).focus();
      }
    }, 200);
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
          console.log(
            `Move ${item.name} ${dropResult.name} to ${dropResult.node.name}`
          );
        }
        setIsDragging(false);
        isDraggingGlobal = false;
      },
    },
    [node]
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
    [node]
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
    [node]
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
    [node]
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
          handleBlur();
        }
      }
    }
  };

  const handleChange = (event: {
    target: { value: React.SetStateAction<string> };
  }) => {
    console.log("handleCnange", node.dir);
    setEditValue(event.target.value);
  };

  const handleBlur = () => {
    if (editValue === node.name){
      setIsEditing(false);
    }else
    if (editValue === "") {
      vscode.postMessage({
        command: "alert",
        alertMessage: "名称は必ず設定してください",
      });
      setEditValue(node.name);
      setIsEditing(false);
    } else {
      const renameFile = {
        targetPath: node.dir,
        newName: editValue,
      };
      vscode.postMessage({
        command: "rename",
        renameFile: renameFile,
      });
      setIsEditing(false);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  return (
    <div
      ref={treeNodeRef}
      tabIndex={-1} // フォーカス可能とする
      onKeyDown={handleKeyDown}
    >

      <div
        ref={isOrdable ? drag : undefined}
        onDragStart={isOrdable ? handleDragStart : undefined}
        onDragEnd={isOrdable? handleDragEnd : undefined}
        className={`tree-node ${expanded ? "expanded" : ""} ${
          isDragging ? "dragged" : ""
        }`}
        onClick={handleNodeClick}
      >
        {isFirstSibling && (
          <div
            ref={dropBefore}
            className={`insert-bar before
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverBefore ? "dropping" : ""}`}
            onDragEnter={handleDragEnterBefore}
            onDragLeave={handleDragLeaveBefore}
          ></div>
        )}
        <div
          className={`tree-label ${!node.children ? "text" : ""} ${
            highlightedNode === node.dir ? "highlighted" : ""
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
                  value={isOrdable ? editValue.replace(
                    /^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/,
                    "$1"
                  ) : editValue}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  onBlur={handleBlur}
                  autoFocus
                  className="item-name-input"
                />
              }
            </span>
          ) : (
            <span className="item-name">
              {isOrdable ? node.name.replace(/^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/, "$1") : node.name}
            </span>
          )}
          <span className="chars">{node.length.toLocaleString()}文字</span>
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
                isOrdable={isOrdable}
              />
            ))}
            <div
              ref={dropInside}
              className={`insert-bar inside
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverInside ? "dropping" : ""}`}
              onDragEnter={handleDragEnterInside}
              onDragLeave={handleDragLeaveInside}
            ></div>
          </div>
        )}

        <div
          ref={dropAfter}
          className={`insert-bar after
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverAfter ? "dropping" : ""}`}
          onDragEnter={handleDragEnterAfter}
          onDragLeave={handleDragLeaveAfter}
        ></div>
      </div>
    </div>
  );
};

// root.render を呼び出す
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
