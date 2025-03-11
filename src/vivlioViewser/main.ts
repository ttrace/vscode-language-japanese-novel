import {
  PageProgression,
  printHTML,
  CoreViewer,
  Navigation,
  PageViewMode,
} from "@vivliostyle/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

// Ensure the wrapper element exists
const wrapper = document.getElementById("vivlio-wrapper");
if (!wrapper) {
  throw new Error("Wrapper element not found");
}

window.addEventListener("message", async (event: MessageEvent) => {
  const message = event.data;
  switch (message.command) {
    case "loadDocument":
      const documentContent = message.content;
      // HTML文字列をBlobに変換し、そのURLを生成
      const blob = new Blob([documentContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const linenumber = message.lineNumber;

      // Callback function to execute when mutations are observed
      const mutationCallback: MutationCallback = (mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.addedNodes[0] instanceof Element) {
            const element = mutation.addedNodes[0] as Element;
            console.log("Vivlio Loading", mutation.addedNodes[0] as Element);
            if (element.getAttribute("data-vivliostyle-page-box")) {
              if (loadInternalLine(Viewer, linenumber)) observer.disconnect();
            }
          }

          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "data-vivliostyle-viewer-status"
          ) {
            const target = mutation.target as HTMLElement;
            const status = target.getAttribute(
              "data-vivliostyle-viewer-status",
            );
            const loading = document.getElementById('loading');
            if (loading) loading.remove();
            if (status === "complete") {
              console.log("Viewer status is complete. Loading line...");
              // Assuming you have a variable `linenumber` available in the scope
              loadInternalLine(Viewer, linenumber);
              observer.disconnect();
            }
          }
        }
      };

      const observer = new MutationObserver(mutationCallback);
      const vivlioObserveconfig = {
        attributes: true,
        childList: true,
        subtree: true,
      };
      observer.observe(wrapper, vivlioObserveconfig);

      Viewer.loadDocument({ url });

      break;
    case "goToLine":
      const linenumberToGo = message.lineNumber;
      loadInternalLine(Viewer, linenumberToGo);
      break;
  }
});

const config = {
  title: "My printed page",
  printCallback: (iframeWin: { print: () => any }) => iframeWin.print(), // optional: only needed if calling something other than window.print() for printing.
  errorCallback: (error: any) => console.error(error), // add errorCallback property
  hideIframe: false, // add hideIframe property
  removeIframe: true, // add removeIframe property
};

const viewer = document.getElementById("viewer");
if (!viewer) {
  throw new Error("Viewer element not found");
}

const settings = {
  viewportElement: viewer as HTMLElement,
};

const options = {
  autoResize: true,
  fitToScreen: true,
  renderAllPages: true,
  pageViewMode: "autoSpread" as PageViewMode,
};

const Viewer = new CoreViewer(settings, options);

document.addEventListener("click", (event) => {
  // クリックされた要素から最も近い、data-vivliostyle-idを持つ親要素を探す
  const targetElement = (event.target as Element)?.closest('[id^="l-"]');
  if (!targetElement) {
    console.error("data-vivliostyle-id attribute not found in ancestors.");
    return;
  }

  const linenNumberToGo = targetElement.id.replace(/^l-([0-9]+)$/, "$1");
  console.log(targetElement, linenNumberToGo);

  // 選択された文字のオフセットを取得
  const selection = window.getSelection();
  if (!selection) return;
  const range = selection.getRangeAt(0);
  // const offset = range ? range.startOffset : 0;

  // テキストノードを収集して全体のテキストを結合
  let totalText = "";
  let clickedOffsetInNode = 0;
  const walker = document.createTreeWalker(
    targetElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    if (currentNode === range.startContainer) {
      clickedOffsetInNode = totalText.length + range.startOffset;
    }
    totalText += currentNode.textContent;
  }

  // VS Codeにメッセージを送信
  vscode.postMessage({
    command: "previewClicked",
    linenNumberToGo,
    offset: clickedOffsetInNode,
  });
});

document.onkeydown = (e) => {
  if (e.key === "ArrowRight") {
    Viewer.navigateToPage(Navigation.PREVIOUS);
    console.log("LR?", Viewer.getCurrentPageProgression());
    console.log(
      document?.querySelector("[data-vivliostyle-spread-container]")
        ?.childElementCount,
    );
  } else if (e.key === "ArrowLeft") {
    Viewer.navigateToPage(Navigation.NEXT);
  }
};

function loadInternalLine(view: CoreViewer, lineNumber: number) {
  // 指定された行番号 ID の要素を探す
  const elementId = `l-${lineNumber}`;
  const targetElement = document.getElementById(elementId);

  if (!targetElement) {
    console.error(`Element with ID ${elementId} not found.`);
    return false; // 要素がない場合は処理を終了
  }

  // クラスを一時的に付与して強調表示
  const highlightClass = "highlight";
  targetElement.classList.add(highlightClass);

  // 設定した時間後にクラスを削除
  setTimeout(() => {
    targetElement.classList.remove(highlightClass);
  }, 1100); // 3秒後にクラスを削除

  // 要素の親を探し、ページインデックスを取得
  let pageContainer = targetElement.closest(
    'div[data-vivliostyle-page-container="true"]',
  );

  if (pageContainer) {
    const pageIndex = pageContainer.getAttribute("data-vivliostyle-page-index");

    if (pageIndex !== null) {
      const pageNumber = parseInt(pageIndex, 10);
      if (!isNaN(pageNumber)) {
        // ページへの移動
        try {
          view.navigateToPage(Navigation.EPAGE, pageNumber);

          console.log(`Navigated to page index: ${pageNumber}`);
          return true;
        } catch (error) {
          console.error(`Error navigating to page: ${error}`);
        }
      } else {
        console.error("Page index is not a valid number.");
      }
    } else {
      console.error("data-vivliostyle-page-index attribute not found.");
    }
  } else {
    console.error("Parent page container not found.");
  }
}
