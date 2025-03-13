import {
  PageProgression,
  printHTML,
  CoreViewer,
  Navigation,
  PageViewMode,
} from "@vivliostyle/core";
import './styles.scss';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();
let pageDirection = "vertical-rl";

document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("vivlio-wrapper");
  const viewer = document.getElementById("viewer");
  const pagebar = document.querySelector("div#pages");

  if (wrapper && viewer && pagebar) {
    // 初期エレメントがあるかどうか
    window.addEventListener("message", async (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "loadDocument":
          pagebar.innerHTML = "";
          pageDirection = message.pageProgression;
          // data-page-direction 属性に値を設定
          const bodyElement = document.querySelector("body");
          bodyElement?.setAttribute("data-page-direction", pageDirection);
          const documentContent = message.content;
          // HTML文字列をBlobに変換し、そのURLを生成
          const blob = new Blob([documentContent], { type: "text/html" });
          const url = URL.createObjectURL(blob);

          const linenumber = message.lineNumber;

          // Callback function to execute when mutations are observed
          let loadInternalLineCalled = false;
          let previousPageNumber = -1;

          const mutationCallback: MutationCallback = async (mutationsList) => {
            for (const mutation of mutationsList) {
              if (mutation.addedNodes[0] instanceof Element) {
                const element = mutation.addedNodes[0] as Element;
                // console.log("Vivlio Loading", mutation.addedNodes[0] as Element);
                if (element.getAttribute("data-vivliostyle-page-container")) {
                  const page = element;
                  const pageIndex = element.getAttribute(
                    "data-vivliostyle-page-index",
                  );
                  console.log("Vivlio page", pageIndex, page);
                  if (pageIndex !== null && !isNaN(parseInt(pageIndex))) {
                    const pageNumber = parseInt(pageIndex);
                    if (pageNumber != previousPageNumber) {
                      // ページアイテム作成
                      const pageButton = document.createElement("div");
                      const pageCount = `${pageNumber + 1}`;
                      pageButton.id = "p-" + pageCount;
                      pageButton.className = "page-button";
                      // pageButton.textContent = pageCount;
                      const pageIndex = document.createElement("span");
                      if(pageNumber > 98) pageIndex.classList.add("century");
                      pageIndex.textContent = pageCount;
                      pageButton.appendChild(pageIndex);
                      pagebar.appendChild(pageButton);
                      previousPageNumber = pageNumber;
                      changeRootCssVariable("--total-page-numbers", pageNumber);
                      pageButton.addEventListener("click", () => {
                        Viewer.navigateToPage(Navigation.EPAGE, pageNumber);
                        console.log("Navigate to", pageNumber);
                        pageActivate(pageNumber);
                      });
                    }
                  }
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
                const loading = document.getElementById("loading");
                if (loading) loading.remove();

                // 前ページの読み込みが終わった時の処理
                if (status === "complete") {
                  const currentPageIndex = searchActivePage();
                  pageActivate(currentPageIndex);
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
        null,
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
        const currentPageIndex = searchActivePage();
        if (pageDirection == "vertical-rl") {
          Viewer.navigateToPage(Navigation.PREVIOUS);
          pageActivate(currentPageIndex - 1);
        } else {
          Viewer.navigateToPage(Navigation.NEXT);
          pageActivate(currentPageIndex + 1);
        }
      } else if (e.key === "ArrowLeft") {
        const currentPageIndex = searchActivePage();
        if (pageDirection == "vertical-rl") {
          Viewer.navigateToPage(Navigation.NEXT);
          pageActivate(currentPageIndex + 1);
        } else {
          Viewer.navigateToPage(Navigation.PREVIOUS);
          pageActivate(currentPageIndex - 1);
        }

      }
    };

    function searchActivePage() {
      const pages = document.querySelectorAll(
        "[data-vivliostyle-page-container]",
      );
      for (const page of Array.from(pages)) {
        const style = window.getComputedStyle(page);
        if (style.display === "block") {
          const pageIndex = page.getAttribute("data-vivliostyle-page-index");
          if (pageIndex) {
            return parseInt(pageIndex, 10); // 要素インデックスを数値に変換して返す
          }
        }
      }
      return -1; // 全ての要素をチェックした後も条件に合致しなかった場合
    }
  }
});

async function loadInternalLine(view: CoreViewer, lineNumber: number) {
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
          pageActivate(pageNumber);
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

function pageActivate(pageNumber: number) {
  const pageButtons = document.querySelectorAll(".page-button");
  if (pageNumber < 0) return;
  if (pageNumber >= pageButtons.length) return;
  const pageButtonId = `p-${pageNumber + 1}`;
  const pageButton = document.getElementById(pageButtonId);

  pageButtons.forEach((button) => {
    button.classList.remove(
      "active",
      "besides",
      "besides-1",
      "besides-2",
      "besides-3",
      "besides-4",
      "besides-5",
      "besides-6",
      "besides-7",
      "besides-8"
    );
  });

  pageButton?.classList.add("active");

  let activeIndex = -1; // 初期値を-1に設定（見つからなかった場合の値）

  if (pageButton) {
    pageButtons.forEach((button, index) => {
      if (button === pageButton) {
        activeIndex = index; // インデックスを更新
      }
    });
  }

  // 前の三つのボタンに 'besides' クラスを追加
  let besideIndex = 0;
  for (let i = Math.max(0, activeIndex - 4); i < activeIndex; i++) {
    besideIndex++;
    const className = `besides-${besideIndex}`;
    pageButtons[i].classList.add(className);
  }

  besideIndex = 4;
  // 後ろの三つのボタンに 'besides' クラスを追加
  for (
    let i = activeIndex + 1;
    i <= Math.min(pageButtons.length - 1, activeIndex + 4);
    i++
  ) {
    besideIndex++;
    const className = `besides-${besideIndex}`;
    pageButtons[i].classList.add(className);
  }
}

function changeRootCssVariable(varName: string, value: any) {
  document.documentElement.style.setProperty(varName, value);
}
