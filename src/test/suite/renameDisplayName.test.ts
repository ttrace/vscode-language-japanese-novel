import * as assert from "assert";
import { renameValueForHost } from "../../renameDisplayName";

suite("rename value for host", () => {
  test("withプロジェクトでは数字prefixと拡張子を加工しない", () => {
    assert.strictEqual(
      renameValueForHost("12-3-Wi-Fi奪取.txt", true, true),
      "12-3-Wi-Fi奪取.txt",
    );
  });

  test("通常プロジェクトでは従来どおり表示名だけを送る", () => {
    assert.strictEqual(renameValueForHost("12-本文.txt", true, false), "本文");
  });
});
